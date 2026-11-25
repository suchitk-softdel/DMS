import { CLAIM_AGING_DAYS, MODULES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'
import { forecastDemand } from './forecastService.js'
import { computeHealthScore } from './healthScoreService.js'
import { recentActivity } from './homeService.js'
import { monthlySalesTotals, salesRevenue } from './salesService.js'

// Dealer 360 / My Performance (SRS 3.3, FR-D360-1 to 5), built in-house from
// the dealer's own data. Every recommendation carries the evidence behind it
// (SRS 6.8).

const TREND_MONTHS = 24
const TIMELINE_LIMIT = 10
const MAX_RECOMMENDATIONS = 4
const PENDING_CLAIM_STAGES = ['submitted', 'underReview']

const round1 = (value) => Math.round(value * 10) / 10
const yearBefore = (date) => {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - 1)
  return result
}
const startOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
const monthKey = (date) => date.toISOString().slice(0, 7)
const addMonths = (key, months) => {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(Date.UTC(year, month - 1 + months, 1)))
}
const money = (value) => `$${Math.round(value).toLocaleString('en-US')}`
// Whole days, rounded up: "more than 10 days" never shows as "10 days".
const ageInDays = (date, now) => Math.ceil((now - date) / DAY_MS)
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`

// Revenue of the 12 months up to `asOf` and the 12 months before.
// change is null when the dealer joined after the earlier period started
// (e.g. a new dealer), because the two periods are not comparable.
async function revenueYear(dealerId, joinedAt, asOf) {
  const yearAgo = yearBefore(asOf)
  const [current, previous] = await Promise.all([
    salesRevenue(dealerId, yearAgo, asOf),
    salesRevenue(dealerId, yearBefore(yearAgo), yearAgo),
  ])
  const comparable = joinedAt <= yearBefore(yearAgo) && previous > 0
  return { current, previous, changePct: comparable ? round1((current / previous - 1) * 100) : null }
}

// FR-D360-1: Revenue, Growth %, Health Score and Territory Coverage tiles.
// Growth and Health Score also show their change since the start of the month.
async function kpis(dealer, now) {
  const monthStart = startOfMonth(now)
  const [revenue, revenueAtMonthStart, health, healthAtMonthStart] = await Promise.all([
    revenueYear(dealer.id, dealer.createdAt, now),
    revenueYear(dealer.id, dealer.createdAt, monthStart),
    computeHealthScore(dealer.id, now),
    computeHealthScore(dealer.id, monthStart),
  ])
  const growthChange =
    revenue.changePct !== null && revenueAtMonthStart.changePct !== null
      ? round1(revenue.changePct - revenueAtMonthStart.changePct)
      : null
  const healthChange =
    health.score !== null && healthAtMonthStart.score !== null ? health.score - healthAtMonthStart.score : null

  return {
    kpis: {
      revenue: { value: Math.round(revenue.current), previous: Math.round(revenue.previous), changePct: revenue.changePct },
      growth: { value: revenue.changePct, changeThisMonth: growthChange },
      healthScore: { value: health.score, changeThisMonth: healthChange },
      territoryCoverage: { value: dealer.territoryCoverage },
    },
    health,
  }
}

// FR-D360-2: monthly revenue for the last 24 months with the same month a year
// earlier, so the page can show any 6 / 12 / 24-month window without another
// request. Months before the dealer joined are null (no data, not zero).
async function revenueTrend(dealer, now) {
  const last = monthKey(now)
  const first = addMonths(last, -(TREND_MONTHS - 1))
  const joined = monthKey(dealer.createdAt)
  const rows = await monthlySalesTotals(dealer.id, { from: addMonths(first, -12), to: last })
  const byMonth = new Map(rows.map((row) => [row.month, row.revenue]))
  const revenueIn = (month) => (month < joined ? null : (byMonth.get(month) ?? 0))

  return Array.from({ length: TREND_MONTHS }, (_, index) => {
    const month = addMonths(first, index)
    return {
      month,
      revenue: revenueIn(month),
      lastYear: revenueIn(addMonths(month, -12)),
      partial: month === last, // the current month is not over yet
    }
  })
}

// ---------------------------------------------------------------------------
// FR-D360-4: recommendations. In-house rules over the dealer's own data; each
// is tied to a Health Score component and shows its evidence. They are ordered
// by how many points that component is missing (its weight x the gap to 100),
// so the actions that matter most for the score come first.
// ---------------------------------------------------------------------------

async function agingClaimsRule(dealerId, now) {
  const agingBefore = new Date(now.getTime() - CLAIM_AGING_DAYS * DAY_MS)
  const claims = await prisma.claim.findMany({
    where: { dealerId, stage: { in: PENDING_CLAIM_STAGES }, stageChangedAt: { lt: agingBefore } },
    orderBy: { stageChangedAt: 'asc' },
    select: { id: true, amount: true, stageChangedAt: true },
  })
  if (!claims.length) return null
  const total = claims.reduce((sum, claim) => sum + claim.amount, 0)
  return {
    key: 'agingClaims',
    component: 'warrantyCompliance',
    title: `Resolve ${plural(claims.length, 'aging claim')}`,
    detail: `${plural(claims.length, 'claim has', 'claims have')} waited more than ${CLAIM_AGING_DAYS} days in the same stage (${money(total)} in total). Open claims past ${CLAIM_AGING_DAYS} days lower Warranty Compliance.`,
    evidence: claims.slice(0, 3).map((claim) => `${claim.id}: ${ageInDays(claim.stageChangedAt, now)} days, ${money(claim.amount)}`),
    action: { label: 'Open Warranty', module: MODULES.WARRANTY },
  }
}

async function trainingRule(dealerId) {
  const rows = await prisma.trainingProgress.findMany({
    where: { user: { dealerId } },
    select: { completedAt: true, userId: true },
  })
  const open = rows.filter((row) => !row.completedAt)
  if (!open.length) return null
  const people = new Set(open.map((row) => row.userId))
  const done = rows.length - open.length
  return {
    key: 'training',
    component: 'trainingCompletion',
    title: `Help ${plural(people.size, 'team member')} finish training`,
    detail: `${plural(open.length, 'assigned course is', 'assigned courses are')} not finished yet. Completed courses raise the Training Completion part of your Health Score.`,
    evidence: [`${done} of ${rows.length} assigned courses completed (${Math.round((done / rows.length) * 100)}%)`],
    action: null, // no Training screen in the app any more
  }
}

async function stockOutRule(dealerId, now) {
  const { items } = await forecastDemand(dealerId, now)
  const short = items.filter((item) => item.shortfall > 0)
  if (!short.length) return null
  const atRisk = short.reduce((sum, item) => sum + item.revenueAtRisk, 0)
  return {
    key: 'stockOut',
    component: 'revenueGrowth',
    urgent: true,
    title: `Reorder ${short.slice(0, 2).map((item) => item.product.sku).join(' and ')}${short.length > 2 ? ` and ${short.length - 2} more` : ''}`,
    detail: `Expected demand in the next 30 days is higher than stock on hand plus on order, putting about ${money(atRisk)} of sales at risk.`,
    evidence: short.slice(0, 3).map((item) => `${item.product.sku}: ${item.onHand} on hand, ${item.onOrder} on order, about ${item.expected} expected to sell`),
    action: { label: 'Open Inventory', module: MODULES.INVENTORY },
  }
}

const RULES = [agingClaimsRule, trainingRule, stockOutRule]
// A stock-out loses sales within weeks, so it is never pushed out of the list
// by a larger but slower score gap.
const URGENT_MIN_POINTS = 10

async function recommendations(dealerId, health, can, now) {
  const results = (await Promise.all(RULES.map((rule) => rule(dealerId, now)))).filter(Boolean)
  const scored = health.components.filter((c) => c.score !== null)
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0) || 1
  const components = new Map(health.components.map((c) => [c.key, c]))

  return results
    .map((rec) => {
      const component = components.get(rec.component)
      // Points of the overall score this component is missing.
      const missing = component.score === null ? 0 : ((100 - component.score) * component.weight) / totalWeight
      const points = Math.max(rec.urgent ? URGENT_MIN_POINTS : 0, missing)
      return {
        ...rec,
        component: { key: component.key, label: component.label, score: component.score },
        pointsMissing: round1(missing),
        priority: points,
        action: rec.action && can(rec.action.module) ? rec.action : null,
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ priority: _priority, urgent: _urgent, ...rec }) => rec)
}

// user: req.user ({ dealerId, permissions }).
// -> { dealer, kpis, trend, health, recommendations, timeline, asOf }
export async function getDealer360(user, now = new Date()) {
  const can = (module) => user.permissions.includes(module)
  const dealer = await prisma.dealer.findUnique({
    where: { id: user.dealerId },
    select: { id: true, name: true, city: true, state: true, region: true, tier: true, status: true, territoryCoverage: true, createdAt: true },
  })
  const [{ kpis: tiles, health }, trend, timeline] = await Promise.all([
    kpis(dealer, now),
    revenueTrend(dealer, now),
    recentActivity(dealer.id, can, TIMELINE_LIMIT),
  ])

  return {
    dealer,
    kpis: tiles,
    trend,
    health,
    recommendations: await recommendations(dealer.id, health, can, now),
    timeline,
    asOf: now,
  }
}
