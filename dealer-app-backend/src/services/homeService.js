import { CLAIM_AGING_DAYS, MODULES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'
import { getDealer } from './catalogService.js'
import { forecastDemand } from './forecastService.js'
import { computeHealthScore } from './healthScoreService.js'

// Home dashboard (SRS 3.1). Each part is only included when the user's role
// can open the module it comes from, so e.g. a technician never receives
// revenue figures (SRS 2.3, 6.2).

const OPEN_ORDER_STATUSES = ['submitted', 'approved']
const PENDING_CLAIM_STAGES = ['submitted', 'underReview']
const ACTIVITY_LIMIT = 6

const round1 = (value) => Math.round(value * 10) / 10
const yearBefore = (date) => {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - 1)
  return result
}
const startOfYear = (date) => new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
const startOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
const changePct = (current, previous) => (previous ? round1((current / previous - 1) * 100) : null)

async function fulfilledRevenue(dealerId, from, to) {
  const result = await prisma.order.aggregate({
    where: { dealerId, type: 'order', status: 'fulfilled', createdAt: { gte: from, lt: to } },
    _sum: { total: true },
  })
  return result._sum.total ?? 0
}

// FR-HOME-2: year-to-date revenue vs the same days last year.
async function revenueYtd(dealerId, now) {
  const lastYearNow = yearBefore(now)
  const [current, previous] = await Promise.all([
    fulfilledRevenue(dealerId, startOfYear(now), now),
    fulfilledRevenue(dealerId, startOfYear(lastYearNow), lastYearNow),
  ])
  return { value: Math.round(current), previous: Math.round(previous), changePct: changePct(current, previous) }
}

// FR-HOME-2: Health Score now and its change since the start of the month.
async function healthScore(dealerId, now) {
  const [current, monthStart] = await Promise.all([
    computeHealthScore(dealerId, now),
    computeHealthScore(dealerId, startOfMonth(now)),
  ])
  const change = current.score !== null && monthStart.score !== null ? current.score - monthStart.score : null
  return { value: current.score, changeThisMonth: change }
}

async function openOrders(dealerId) {
  const [open, awaitingApproval] = await Promise.all([
    prisma.order.count({ where: { dealerId, type: 'order', status: { in: OPEN_ORDER_STATUSES } } }),
    prisma.order.count({ where: { dealerId, type: 'order', status: 'submitted' } }),
  ])
  return { value: open, awaitingApproval }
}

async function pendingClaims(dealerId, now) {
  const agingBefore = new Date(now.getTime() - CLAIM_AGING_DAYS * DAY_MS)
  const [pending, aging] = await Promise.all([
    prisma.claim.count({ where: { dealerId, stage: { in: PENDING_CLAIM_STAGES } } }),
    prisma.claim.count({
      where: { dealerId, stage: { in: PENDING_CLAIM_STAGES }, stageChangedAt: { lt: agingBefore } },
    }),
  ])
  return { value: pending, aging, agingDays: CLAIM_AGING_DAYS }
}

// ---------------------------------------------------------------------------
// AI Insight (FR-HOME-3): in-house rules over the dealer's own data. The first
// rule that finds something worth acting on wins.
// ---------------------------------------------------------------------------

// Stock-out risk: expected demand for the next 30 days (same month last year,
// adjusted for the dealer's unit growth) is more than stock on hand + on order.
async function stockOutInsight(dealerId, now) {
  const { growth, items } = await forecastDemand(dealerId, now)
  const atRisk = items.filter((row) => row.shortfall > 0).slice(0, 2)

  if (atRisk.length === 0) return null
  const skus = atRisk.map((row) => row.product.sku).join(' and ')
  return {
    kind: 'stockOut',
    message: `${skus} ${atRisk.length > 1 ? 'are' : 'is'} projected to run short in the next 30 days. Reorder now to cover expected demand.`,
    evidence: [
      ...atRisk.map(
        (row) => `${row.product.sku}: ${row.onHand} on hand, ${row.onOrder} on order, about ${row.expected} expected to sell`,
      ),
      `Forecast: same month last year, adjusted for ${round1((growth - 1) * 100)}% unit growth`,
    ],
    action: { label: 'Place Reorder', module: MODULES.INVENTORY },
  }
}

async function agingClaimsInsight(dealerId, now) {
  const { aging } = await pendingClaims(dealerId, now)
  if (aging === 0) return null
  return {
    kind: 'agingClaims',
    message: `${aging} warranty ${aging === 1 ? 'claim has' : 'claims have'} been waiting more than ${CLAIM_AGING_DAYS} days. Follow up to avoid reimbursement delays.`,
    evidence: [`Claims in Submitted or Under Review for over ${CLAIM_AGING_DAYS} days: ${aging}`],
    action: { label: 'View Claims', module: MODULES.WARRANTY },
  }
}

async function revenueInsight(dealerId, now) {
  const { changePct: change } = await revenueYtd(dealerId, now)
  if (change === null) return null
  return {
    kind: 'revenueTrend',
    message: `Revenue is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% year-to-date compared with the same period last year.`,
    evidence: ['Fulfilled orders this year vs the same dates last year'],
    action: { label: 'Open Dealer 360', module: MODULES.DEALER_360 },
  }
}

const INSIGHT_RULES = [
  { module: MODULES.INVENTORY, rule: stockOutInsight },
  { module: MODULES.WARRANTY, rule: agingClaimsInsight },
  { module: MODULES.DEALER_360, rule: revenueInsight },
]

async function insight(dealerId, can, now) {
  for (const { module, rule } of INSIGHT_RULES) {
    if (!can(module)) continue
    const result = await rule(dealerId, now)
    if (result) return result
  }
  return null
}

// ---------------------------------------------------------------------------
// Recent Activity (FR-HOME-5): latest orders, claims and training completions.
// ---------------------------------------------------------------------------

async function recentActivity(dealerId, can) {
  const sources = []

  if (can(MODULES.ORDERS)) {
    sources.push(
      prisma.order
        .findMany({
          where: { dealerId, type: 'order', status: { not: 'draft' } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { id: true, total: true, createdAt: true },
        })
        .then((rows) =>
          rows.map((row) => ({ date: row.createdAt, type: 'order', ref: row.id, amount: row.total })),
        ),
    )
  }

  if (can(MODULES.WARRANTY)) {
    sources.push(
      prisma.claim
        .findMany({ where: { dealerId }, orderBy: { filedAt: 'desc' }, take: 3, select: { id: true, amount: true, filedAt: true } })
        .then((rows) =>
          rows.map((row) => ({ date: row.filedAt, type: 'claimSubmitted', ref: row.id, amount: row.amount })),
        ),
      prisma.claim
        .findMany({
          where: { dealerId, resolvedAt: { not: null } },
          orderBy: { resolvedAt: 'desc' },
          take: 2,
          select: { id: true, stage: true, amount: true, resolvedAt: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            date: row.resolvedAt,
            type: 'claimResolved',
            ref: row.id,
            stage: row.stage,
            amount: row.amount,
          })),
        ),
    )
  }

  if (can(MODULES.INCENTIVES)) {
    sources.push(
      prisma.trainingProgress
        .findMany({
          where: { user: { dealerId }, completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
          take: 2,
          select: { completedAt: true, course: { select: { title: true } } },
        })
        .then((rows) =>
          rows.map((row) => ({ date: row.completedAt, type: 'trainingCompleted', ref: row.course.title, amount: null })),
        ),
    )
  }

  const events = (await Promise.all(sources)).flat()
  return events.sort((a, b) => b.date - a.date).slice(0, ACTIVITY_LIMIT)
}

// ---------------------------------------------------------------------------

// user: req.user from requireAuth ({ dealerId, permissions, ... }).
// -> { dealer, kpis: { revenueYtd?, healthScore?, openOrders?, pendingClaims? }, insight,
//      activity: [{ date, type: order|claimSubmitted|claimResolved|trainingCompleted, ref, amount, stage? }] }
export async function getHomeSummary(user, now = new Date()) {
  const { dealerId } = user
  const can = (module) => user.permissions.includes(module)

  const [dealer, revenue, health, orders, claims, aiInsight, activity] = await Promise.all([
    getDealer(dealerId),
    can(MODULES.DEALER_360) ? revenueYtd(dealerId, now) : null,
    can(MODULES.DEALER_360) ? healthScore(dealerId, now) : null,
    can(MODULES.ORDERS) ? openOrders(dealerId) : null,
    can(MODULES.WARRANTY) ? pendingClaims(dealerId, now) : null,
    insight(dealerId, can, now),
    recentActivity(dealerId, can),
  ])

  const kpis = {}
  if (revenue) kpis.revenueYtd = revenue
  if (health) kpis.healthScore = health
  if (orders) kpis.openOrders = orders
  if (claims) kpis.pendingClaims = claims

  return { dealer, kpis, insight: aiInsight, activity }
}
