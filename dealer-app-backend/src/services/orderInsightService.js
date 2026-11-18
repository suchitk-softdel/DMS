import { MODULES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'

// Orders & Quotes summary (SRS 3.4): counts per status, orders awaiting
// approval (FR-ORD-6) and the Order Insight (FR-ORD-5), built in-house.
//
// Order Insight: which open quotes are likely to close. For an open quote that
// is D days old, it looks at the dealer's past quotes that were still open at
// D days and counts how many were approved afterwards. That share is the
// quote's chance of closing, and it is shown with the numbers behind it.

// A quote not approved within this many days counts as lost (past quotes are
// approved within about 10 days), so only quotes older than this have a known
// outcome and are used to learn from.
const OUTCOME_DAYS = 30
// Fewer past quotes than this at a given age: use the whole network's history.
const MIN_HISTORY = 20
const LIKELY = 0.4
// Below this chance a quote has gone cold.
const COLD = 0.1
const SHOWN = 3

const ageInDays = (from, to) => (to - from) / DAY_MS
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`
const money = (value) => `$${Math.round(value).toLocaleString('en-US')}`

// Past quotes with their approval date (from the audit log).
async function quoteHistory(where, now) {
  const quotes = await prisma.order.findMany({
    where: { ...where, type: 'quote', status: { not: 'draft' }, createdAt: { lt: new Date(now.getTime() - OUTCOME_DAYS * DAY_MS) } },
    select: { id: true, createdAt: true, status: true, updatedAt: true },
  })
  const approvals = await prisma.auditLog.findMany({
    where: { action: 'quote.status', entityId: { in: quotes.map((q) => q.id) } },
    select: { entityId: true, details: true, createdAt: true },
  })
  const approvedAt = new Map()
  for (const row of approvals) {
    if (JSON.parse(row.details ?? '{}').to === 'approved') approvedAt.set(row.entityId, row.createdAt)
  }
  return quotes.map((q) => ({
    createdAt: q.createdAt,
    approvedAfter: q.status === 'approved' ? ageInDays(q.createdAt, approvedAt.get(q.id) ?? q.updatedAt) : null,
  }))
}

// Of the past quotes still open at `age` days, the share approved afterwards.
function closeRate(history, age) {
  const openAtAge = history.filter((q) => q.approvedAfter === null || q.approvedAfter >= age)
  const closed = openAtAge.filter((q) => q.approvedAfter !== null && q.approvedAfter <= OUTCOME_DAYS).length
  return { rate: openAtAge.length ? closed / openAtAge.length : 0, sample: openAtAge.length, closed }
}

export async function orderInsight(dealerId, now = new Date()) {
  const open = await prisma.order.findMany({
    where: { dealerId, type: 'quote', status: 'submitted' },
    select: { id: true, total: true, createdAt: true, customer: { select: { name: true } } },
  })
  if (!open.length) return null

  const own = await quoteHistory({ dealerId }, now)
  let network = null
  const scored = []
  for (const quote of open) {
    const age = ageInDays(quote.createdAt, now)
    let basis = closeRate(own, age)
    let source = 'your'
    if (basis.sample < MIN_HISTORY) {
      network ??= await quoteHistory({}, now)
      basis = closeRate(network, age)
      source = 'network'
    }
    scored.push({
      id: quote.id,
      customer: quote.customer.name,
      total: quote.total,
      ageDays: Math.floor(age),
      probability: Math.round(basis.rate * 100) / 100,
      evidence: `${basis.sample} ${source === 'your' ? 'of your past quotes' : 'past quotes across the network'} were still open after ${days(Math.floor(age))}; ${basis.closed} of them were approved (${Math.round(basis.rate * 100)}%)`,
    })
  }

  // Most likely first; among equals, the larger quote first.
  const likely = scored
    .filter((q) => q.probability >= LIKELY)
    .sort((a, b) => b.probability - a.probability || b.total - a.total)
  const cold = scored.filter((q) => q.probability < COLD)
  const coldValue = cold.reduce((sum, q) => sum + q.total, 0)
  const top = likely.slice(0, SHOWN)

  const message = top.length
    ? `${top.length === 1 ? '1 open quote is' : `${likely.length} open quotes are`} likely to close soon: ${top
        .map((q) => `${q.id} for ${q.customer} (${money(q.total)}, ${Math.round(q.probability * 100)}%)`)
        .join(', ')}.`
    : `None of your ${open.length} open quotes is likely to close soon: past quotes this old were rarely approved.`
  const evidence = [
    ...top.map((q) => `${q.id}: ${q.evidence}`),
    ...(cold.length
      ? [`${cold.length} ${cold.length === 1 ? 'quote' : 'quotes'} (${money(coldValue)}) ${cold.length === 1 ? 'is' : 'are'} unlikely to close; follow up or close ${cold.length === 1 ? 'it' : 'them'} as lost.`]
      : []),
  ]

  return {
    message,
    evidence,
    likely: top,
    cold: { count: cold.length, value: Math.round(coldValue * 100) / 100 },
    action: { label: 'Open Sales Coach', module: MODULES.SALES_COACH },
  }
}

// -> { counts: { order: { draft, submitted, approved, rejected, accepted, declined, fulfilled },
//                quote: { draft, submitted, approved } },
//      openOrders, awaitingApproval, quotesToAccept, insight }
export async function getOrdersSummary(user, now = new Date()) {
  const { dealerId } = user
  const groups = await prisma.order.groupBy({ by: ['type', 'status'], where: { dealerId }, _count: { _all: true } })
  const counts = {
    order: { draft: 0, submitted: 0, approved: 0, rejected: 0, accepted: 0, declined: 0, fulfilled: 0 },
    quote: { draft: 0, submitted: 0, approved: 0 },
  }
  for (const g of groups) counts[g.type][g.status] = g._count._all

  return {
    counts,
    openOrders: counts.order.submitted + counts.order.approved + counts.order.accepted,
    awaitingApproval: counts.order.submitted,
    // Manufacturer quotes waiting for the dealer to accept or decline.
    quotesToAccept: counts.order.approved,
    insight: await orderInsight(dealerId, now),
  }
}
