import { prisma } from '../db/prisma.js'
import { daysSince } from '../utils/query.js'

// Warranty claims for one dealer (SRS 3.7). `ageDays` is the number of days
// in the current stage, shown on each kanban card (FR-WAR-3).
export async function listClaims(dealerId, { stage }) {
  const rows = await prisma.claim.findMany({
    where: { dealerId, ...(stage && { stage }) },
    orderBy: { filedAt: 'desc' },
    include: {
      product: { select: { id: true, sku: true, name: true } },
      customer: { select: { id: true, name: true } },
    },
  })
  const now = new Date()
  return rows.map(({ dealerId: _d, productId: _p, customerId: _c, ...claim }) => ({
    ...claim,
    ageDays: daysSince(claim.stageChangedAt, now),
  }))
}
