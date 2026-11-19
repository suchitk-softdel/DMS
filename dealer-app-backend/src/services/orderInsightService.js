import { prisma } from '../db/prisma.js'

// Orders summary for the dealer (SRS 3.4): counts per status, orders waiting
// for the manufacturer (FR-ORD-6) and manufacturer quotes waiting for the
// dealer's answer. The app is dealer <-> manufacturer only, so customer quotes
// (and the insight on them) are no longer part of it.

// -> { counts: { order: { draft, submitted, approved, rejected, accepted, declined, fulfilled },
//                quote: { draft, submitted, approved } },
//      openOrders, awaitingApproval, quotesToAccept }
export async function getOrdersSummary(user) {
  const { dealerId } = user
  const groups = await prisma.order.groupBy({ by: ['type', 'status'], where: { dealerId }, _count: { _all: true } })
  const counts = {
    order: { draft: 0, submitted: 0, approved: 0, rejected: 0, accepted: 0, declined: 0, fulfilled: 0 },
    quote: { draft: 0, submitted: 0, approved: 0 },
  }
  for (const g of groups) counts[g.type][g.status] = g._count._all

  return {
    counts,
    // Not finished yet: requested, quoted by the manufacturer, or accepted.
    openOrders: counts.order.submitted + counts.order.approved + counts.order.accepted,
    // Order requests waiting for the manufacturer.
    awaitingApproval: counts.order.submitted,
    // Manufacturer quotes waiting for the dealer to accept or decline.
    quotesToAccept: counts.order.approved,
  }
}
