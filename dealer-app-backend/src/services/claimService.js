import { CLAIM_AGING_DAYS, CLAIM_STAGES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { badRequest } from '../utils/httpError.js'
import { DAY_MS } from '../utils/query.js'
import { logAudit } from './auditLog.js'

const OPEN_STAGES = ['submitted', 'underReview']

const CLAIM_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  customer: { select: { id: true, name: true } },
}

const toClaimView = ({ dealerId: _d, productId: _p, customerId: _c, ...claim }, now = new Date()) => ({
  ...claim,
  // Whole days, rounded up (as in Dealer 360): "more than 10 days" never shows as "10d".
  ageDays: Math.max(0, Math.ceil((now - claim.stageChangedAt) / DAY_MS)),
})

// Warranty claims for one dealer (SRS 3.7). The dealer submits and tracks
// claims; the decision (approve, reject, reimburse) is the manufacturer's. `ageDays` is the number of days
// in the current stage, shown on each kanban card (FR-WAR-3).
export async function listClaims(dealerId, { stage }) {
  const rows = await prisma.claim.findMany({
    where: { dealerId, ...(stage && { stage }) },
    orderBy: { filedAt: 'desc' },
    include: CLAIM_INCLUDE,
  })
  const now = new Date()
  return rows.map((row) => toClaimView(row, now))
}

// Registered units for this dealer, for choosing the unit a claim is for.
export function listRegistrations(dealerId, { search, limit }) {
  return prisma.warrantyRegistration.findMany({
    where: {
      dealerId,
      ...(search && {
        OR: [{ serialNumber: { contains: search } }, { customer: { name: { contains: search } } }],
      }),
    },
    orderBy: { installDate: 'desc' },
    take: limit,
    select: {
      id: true,
      serialNumber: true,
      orderId: true,
      installDate: true,
      product: { select: { id: true, sku: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  })
}

// Files a claim against a registered unit. Product, customer and order all
// come from the registration, so the claim is always linked correctly.
// input: { registrationId, amount, description }
export async function createClaim(user, input) {
  const registration = await prisma.warrantyRegistration.findFirst({
    where: { id: input.registrationId, dealerId: user.dealerId },
  })
  if (!registration) throw badRequest('Registered unit not found for this dealership.')

  const open = await prisma.claim.findFirst({
    where: { registrationId: registration.id, stage: { in: ['submitted', 'underReview', 'approved'] } },
  })
  if (open) throw badRequest(`Unit ${registration.serialNumber} already has an open claim (${open.id}).`)

  const [{ maxSeq }] = await prisma.$queryRaw`
    SELECT MAX(CAST(substr(id, 5) AS INTEGER)) AS maxSeq FROM "Claim"`
  const now = new Date()
  const claim = await prisma.claim.create({
    data: {
      id: `CLM-${Number(maxSeq ?? 20000) + 1}`,
      dealerId: user.dealerId,
      registrationId: registration.id,
      orderId: registration.orderId,
      productId: registration.productId,
      customerId: registration.customerId,
      serialNumber: registration.serialNumber,
      amount: Math.round(input.amount * 100) / 100,
      description: input.description,
      stage: 'submitted',
      filedAt: now,
      stageChangedAt: now,
    },
    include: CLAIM_INCLUDE,
  })

  await logAudit({ userId: user.id, action: 'claim.submit', entity: 'Claim', entityId: claim.id, details: { amount: claim.amount } })
  return toClaimView(claim, now)
}

// Summary tiles for the Warranty board (FR-WAR-4). Resolution time and
// approval rate use claims decided in the last 12 months, so old history does
// not hide recent changes.
//   openClaims: Submitted + Under Review; aging: of those, more than 10 days in the stage
//   avgResolutionDays: average days from filing to the decision (approved, reimbursed or rejected)
//   approvalRate: approved or reimbursed / all decided claims (0..1)
export async function getClaimsSummary(dealerId, now = new Date()) {
  const yearAgo = new Date(now)
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1)
  const agingBefore = new Date(now.getTime() - CLAIM_AGING_DAYS * DAY_MS)
  const [groups, aging, decided] = await Promise.all([
    prisma.claim.groupBy({ by: ['stage'], where: { dealerId }, _count: { _all: true } }),
    prisma.claim.count({ where: { dealerId, stage: { in: OPEN_STAGES }, stageChangedAt: { lt: agingBefore } } }),
    prisma.claim.findMany({
      where: { dealerId, stage: { in: ['approved', 'reimbursed', 'rejected'] }, resolvedAt: { gte: yearAgo, lte: now } },
      select: { stage: true, filedAt: true, resolvedAt: true },
    }),
  ])
  const counts = Object.fromEntries(CLAIM_STAGES.map((stage) => [stage, 0]))
  for (const g of groups) counts[g.stage] = g._count._all
  const approved = decided.filter((c) => c.stage !== 'rejected').length
  const days = decided.reduce((sum, c) => sum + (c.resolvedAt - c.filedAt) / DAY_MS, 0)

  return {
    counts,
    openClaims: counts.submitted + counts.underReview,
    aging,
    agingDays: CLAIM_AGING_DAYS,
    decided: decided.length,
    rejected: decided.length - approved,
    avgResolutionDays: decided.length ? Math.round((days / decided.length) * 10) / 10 : null,
    approvalRate: decided.length ? Math.round((approved / decided.length) * 1000) / 1000 : null,
  }
}
