import { CLAIM_AGING_DAYS, CLAIM_STAGES, EQUIPMENT_CATEGORIES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { badRequest } from '../utils/httpError.js'
import { DAY_MS } from '../utils/query.js'
import { logAudit } from './auditLog.js'
import { publishWarrantyEvent } from './liveEvents.js'

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

// ---------------------------------------------------------------------------
// Warranty: each product has its own length (Product.warrantyYears, 1 year by
// default), counted from the install date. Change it per product in the
// database; no code change is needed.
// ---------------------------------------------------------------------------

// Serial numbers start after this when the table is empty (SN5000001, ...).
const FIRST_SERIAL = 5000000

// Claim stages that still block a new claim on the same unit.
const ACTIVE_CLAIM_STAGES = ['submitted', 'underReview', 'approved']
const fmtDate = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Last day the unit is covered: install date + warranty years.
export function warrantyEnd(installDate, years) {
  const end = new Date(installDate)
  end.setUTCFullYear(end.getUTCFullYear() + years)
  return end
}

// Registered units for this dealer, for choosing the unit a claim is for.
// Each unit says until when it is covered and whether it already has an open claim.
export async function listRegistrations(dealerId, { search, productId, limit }, now = new Date()) {
  const rows = await prisma.warrantyRegistration.findMany({
    where: {
      dealerId,
      ...(productId && { productId }),
      ...(search && {
        OR: [{ serialNumber: { contains: search } }, { product: { sku: { contains: search } } }, { orderId: { contains: search } }],
      }),
    },
    orderBy: { installDate: 'desc' },
    take: limit,
    select: {
      id: true,
      serialNumber: true,
      orderId: true,
      installDate: true,
      product: { select: { id: true, sku: true, name: true, unitPrice: true, warrantyYears: true } },
      claims: { where: { stage: { in: ACTIVE_CLAIM_STAGES } }, select: { id: true }, take: 1 },
    },
  })
  return rows.map(({ claims, ...row }) => {
    const warrantyUntil = warrantyEnd(row.installDate, row.product.warrantyYears)
    return { ...row, warrantyUntil, expired: warrantyUntil < now, openClaimId: claims[0]?.id ?? null }
  })
}

// Equipment units of fulfilled orders that are not registered yet: what the
// dealer can pick in "Register Warranty". One row per order line.
// -> [{ orderItemId, orderId, fulfilledAt, product, quantity, registered }]
export async function listUnregisteredUnits(dealerId) {
  const lines = await prisma.orderItem.findMany({
    where: {
      order: { dealerId, type: 'order', status: 'fulfilled' },
      product: { category: { in: [...EQUIPMENT_CATEGORIES] } },
    },
    orderBy: { order: { updatedAt: 'desc' } },
    select: {
      id: true,
      quantity: true,
      order: { select: { id: true, updatedAt: true } },
      product: { select: { id: true, sku: true, name: true, warrantyYears: true } },
      _count: { select: { registrations: true } },
    },
  })
  return lines
    .filter((line) => line._count.registrations < line.quantity)
    .map((line) => ({
      orderItemId: line.id,
      orderId: line.order.id,
      fulfilledAt: line.order.updatedAt,
      product: line.product,
      quantity: line.quantity,
      registered: line._count.registrations,
    }))
}

// The next serial number in the SN series (e.g. SN5002946). The form shows it
// as soon as a unit is picked; registerWarranty assigns it when saving.
async function nextSerialNumber(db = prisma) {
  const [{ maxSerial }] = await db.$queryRaw`
    SELECT MAX(CAST(substr(serialNumber, 3) AS INTEGER)) AS maxSerial
    FROM "WarrantyRegistration" WHERE serialNumber GLOB 'SN[0-9]*'`
  return `SN${Number(maxSerial ?? FIRST_SERIAL) + 1}`
}

export const previewSerialNumber = () => nextSerialNumber()

// Registers one installed unit (FR-WAR-1). Both values are set by the system,
// never typed by the dealer: the serial number is the next number in the SN
// series (e.g. SN5002946), and the install date is the day of registration
// (today). The warranty runs from that date. input: { orderItemId }
export async function registerWarranty(user, input, now = new Date()) {
  const line = await prisma.orderItem.findFirst({
    where: { id: input.orderItemId, order: { dealerId: user.dealerId } },
    include: {
      order: { select: { id: true, type: true, status: true, updatedAt: true, customerId: true } },
      product: { select: { sku: true, category: true } },
      _count: { select: { registrations: true } },
    },
  })
  if (!line) throw badRequest('Order line not found for this dealership.')
  if (line.order.type !== 'order' || line.order.status !== 'fulfilled') {
    throw badRequest(`Order ${line.order.id} is not fulfilled yet. Units can be registered once the order is fulfilled.`)
  }
  if (!EQUIPMENT_CATEGORIES.includes(line.product.category)) {
    throw badRequest(`${line.product.sku} is not serialised equipment, so it has no warranty registration.`)
  }
  if (line._count.registrations >= line.quantity) {
    throw badRequest(`All ${line.quantity} units of ${line.product.sku} on ${line.order.id} are already registered.`)
  }

  // Install date = today (not editable).
  const installDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Next serial number and the new row in one transaction, so two
  // registrations at the same moment never get the same number.
  const registration = await prisma.$transaction(async (tx) => {
    const serialNumber = await nextSerialNumber(tx)
    return tx.warrantyRegistration.create({
      data: {
        id: `wr-${serialNumber}`,
        dealerId: user.dealerId,
        orderId: line.order.id,
        orderItemId: line.id,
        productId: line.productId,
        customerId: line.order.customerId,
        serialNumber,
        installDate,
        createdAt: now,
      },
      select: { id: true, serialNumber: true, orderId: true, installDate: true, product: { select: { id: true, sku: true, name: true, warrantyYears: true } } },
    })
  })
  await logAudit({ userId: user.id, action: 'warranty.register', entity: 'WarrantyRegistration', entityId: registration.id, details: { serialNumber: registration.serialNumber } })
  publishWarrantyEvent({ action: 'registration.created', dealerId: user.dealerId, id: registration.serialNumber, by: user.id })
  return { ...registration, warrantyUntil: warrantyEnd(installDate, registration.product.warrantyYears) }
}

// Files a claim against a registered unit. Product, customer and order all
// come from the registration, so the claim is always linked correctly.
// Refused when the warranty has expired, when the unit already has an open
// claim, or when the amount is more than the product's price.
// input: { registrationId, amount, description }
export async function createClaim(user, input) {
  const registration = await prisma.warrantyRegistration.findFirst({
    where: { id: input.registrationId, dealerId: user.dealerId },
    include: { product: { select: { sku: true, unitPrice: true, warrantyYears: true } } },
  })
  if (!registration) throw badRequest('Registered unit not found for this dealership.')

  const years = registration.product.warrantyYears
  const until = warrantyEnd(registration.installDate, years)
  if (until < new Date()) {
    throw badRequest(
      `The warranty for ${registration.serialNumber} expired on ${fmtDate(until)} (${years}-year warranty from install on ${fmtDate(registration.installDate)}). A claim can't be submitted.`,
    )
  }

  if (input.amount > registration.product.unitPrice) {
    throw badRequest(
      `Claim amount can't be more than the price of ${registration.product.sku} ($${registration.product.unitPrice.toLocaleString('en-US')}).`,
    )
  }

  const open = await prisma.claim.findFirst({
    where: { registrationId: registration.id, stage: { in: ACTIVE_CLAIM_STAGES } },
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
  publishWarrantyEvent({ action: 'claim.submitted', dealerId: user.dealerId, id: claim.id, by: user.id })
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
