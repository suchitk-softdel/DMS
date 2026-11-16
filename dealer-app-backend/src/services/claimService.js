import { CLAIM_TRANSITIONS } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { badRequest, notFound } from '../utils/httpError.js'
import { daysSince } from '../utils/query.js'
import { logAudit } from './auditLog.js'

const CLAIM_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  customer: { select: { id: true, name: true } },
}

const toClaimView = ({ dealerId: _d, productId: _p, customerId: _c, ...claim }, now = new Date()) => ({
  ...claim,
  ageDays: daysSince(claim.stageChangedAt, now),
})

// Warranty claims for one dealer (SRS 3.7). `ageDays` is the number of days
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

// Moves a claim to its next kanban stage (FR-WAR-2).
export async function updateClaimStage(user, claimId, stage) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, dealerId: user.dealerId } })
  if (!claim) throw notFound('Claim not found.')
  const allowed = CLAIM_TRANSITIONS[claim.stage] ?? []
  if (!allowed.includes(stage)) {
    throw badRequest(
      allowed.length
        ? `A claim in ${claim.stage} can only move to: ${allowed.join(', ')}.`
        : `A ${claim.stage} claim cannot be changed.`,
    )
  }

  const now = new Date()
  const resolved = stage === 'reimbursed' || stage === 'rejected'
  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { stage, stageChangedAt: now, ...(resolved && { resolvedAt: now }) },
    include: CLAIM_INCLUDE,
  })

  await logAudit({ userId: user.id, action: 'claim.stage', entity: 'Claim', entityId: claim.id, details: { from: claim.stage, to: stage } })
  return toClaimView(updated, now)
}
