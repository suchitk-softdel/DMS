import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'

// Orders summary for the dealer (SRS 3.4): counts per status, orders waiting
// for the manufacturer (FR-ORD-6) and manufacturer quotes waiting for the
// dealer's answer, plus the insights shown at the top of the Orders screen.
// The app is dealer <-> manufacturer only, so customer quotes are not part of it.

const round2 = (value) => Math.round(value * 100) / 100
const daysBetween = (from, to) => Math.max(0, Math.floor((to - from) / DAY_MS))

// -> { counts: { order: { draft, submitted, approved, rejected, accepted, declined, fulfilled },
//                quote: { draft, submitted, approved } },
//      openOrders, awaitingApproval, quotesToAccept,
//      insights: { quotes, waiting, toReceive, last30, approval } }
export async function getOrdersSummary(user, now = new Date()) {
  const { dealerId } = user
  const ago = (days) => new Date(now.getTime() - days * DAY_MS)

  const [groups, quotes, waiting, toReceive, recent, decided] = await Promise.all([
    prisma.order.groupBy({ by: ['type', 'status'], where: { dealerId }, _count: { _all: true } }),
    // Manufacturer quotes waiting for the dealer to accept or decline.
    prisma.order.findMany({
      where: { dealerId, type: 'order', status: 'approved' },
      select: { id: true, total: true, reviewedAt: true, createdAt: true },
    }),
    // Requests waiting for the manufacturer.
    prisma.order.findMany({ where: { dealerId, type: 'order', status: 'submitted' }, select: { id: true, createdAt: true } }),
    // Accepted, waiting to be received (fulfilled).
    prisma.order.findMany({
      where: { dealerId, type: 'order', status: 'accepted' },
      select: { id: true, total: true, dealerRespondedAt: true, updatedAt: true },
    }),
    // Orders placed in the last 60 days (this 30 days vs the 30 before).
    prisma.order.findMany({
      where: { dealerId, type: 'order', status: { notIn: ['draft'] }, createdAt: { gte: ago(60), lte: now } },
      select: { createdAt: true, total: true, status: true },
    }),
    // Manufacturer decisions in the last 90 days.
    prisma.order.findMany({
      where: { dealerId, type: 'order', reviewedAt: { gte: ago(90), lte: now }, status: { not: 'submitted' } },
      select: { createdAt: true, reviewedAt: true, status: true },
    }),
  ])

  const counts = {
    order: { draft: 0, submitted: 0, approved: 0, rejected: 0, accepted: 0, declined: 0, fulfilled: 0 },
    quote: { draft: 0, submitted: 0, approved: 0 },
  }
  for (const g of groups) counts[g.type][g.status] = g._count._all

  // Oldest item of a list by its "waiting since" date.
  const oldest = (rows, since) => {
    const first = [...rows].sort((a, b) => since(a) - since(b))[0]
    return first ? { id: first.id, days: daysBetween(since(first), now) } : null
  }

  // Priced orders only (a request has no price until the manufacturer quotes it).
  const priced = (rows) => rows.filter((r) => r.status !== 'submitted' && r.status !== 'rejected')
  const thisPeriod = recent.filter((r) => r.createdAt >= ago(30))
  const before = recent.filter((r) => r.createdAt < ago(30))
  const sum = (rows) => round2(rows.reduce((s, r) => s + r.total, 0))
  const approvalDays = decided.map((o) => (o.reviewedAt - o.createdAt) / DAY_MS)
  const rejected = decided.filter((o) => o.status === 'rejected').length

  return {
    counts,
    // Not finished yet: requested, quoted by the manufacturer, or accepted.
    openOrders: counts.order.submitted + counts.order.approved + counts.order.accepted,
    // Order requests waiting for the manufacturer.
    awaitingApproval: counts.order.submitted,
    // Manufacturer quotes waiting for the dealer to accept or decline.
    quotesToAccept: counts.order.approved,
    insights: {
      // Needs the dealer's action: accept or decline.
      quotes: {
        count: quotes.length,
        value: sum(quotes),
        oldest: oldest(quotes, (q) => q.reviewedAt ?? q.createdAt),
      },
      // Waiting for the manufacturer's decision.
      waiting: { count: waiting.length, oldest: oldest(waiting, (w) => w.createdAt) },
      // Accepted, to receive and mark fulfilled.
      toReceive: {
        count: toReceive.length,
        value: sum(toReceive),
        oldest: oldest(toReceive, (o) => o.dealerRespondedAt ?? o.updatedAt),
      },
      // Orders placed in the last 30 days compared with the 30 days before.
      last30: {
        count: thisPeriod.length,
        value: sum(priced(thisPeriod)),
        previousCount: before.length,
        previousValue: sum(priced(before)),
      },
      // How the manufacturer answered in the last 90 days.
      approval: {
        decided: decided.length,
        rejected,
        rate: decided.length ? round2((decided.length - rejected) / decided.length) : null,
        avgDays: approvalDays.length ? round2(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length) : null,
      },
    },
  }
}
