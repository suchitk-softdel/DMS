import { CLAIM_AGING_DAYS, HEALTH_SCORE_WEIGHTS } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { salesRevenue } from './salesService.js'
import { DAY_MS, daysSince } from '../utils/query.js'

// Dealer Health Score (FR-D360-3), built in-house from the dealer's own data.
// Each component is scored 0-100 with a plain rule and carries the evidence
// behind it (SRS 6.8), so the score can always be explained.
//
// Every function takes `asOf`, so the score can be computed for a past date
// (e.g. the start of the month, to show how it changed).

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round1 = (value) => Math.round(value * 10) / 10
const daysBefore = (date, days) => new Date(date.getTime() - days * DAY_MS)
const yearBefore = (date) => {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - 1)
  return result
}

// A change of 0% scores 50; +20% or more scores 100; -20% or less scores 0.
const scoreFromChange = (change) => Math.round(clamp(50 + change * 250))
const percent = (change) => `${change >= 0 ? '+' : ''}${round1(change * 100)}%`

// Revenue of the last 12 months vs the 12 months before.
async function revenueGrowth(dealerId, asOf) {
  const yearAgo = yearBefore(asOf)
  const [current, previous] = await Promise.all([
    salesRevenue(dealerId, yearAgo, asOf),
    salesRevenue(dealerId, yearBefore(yearAgo), yearAgo),
  ])
  if (previous === 0) return { score: null, evidence: 'Not enough history to compare revenue.' }
  const change = current / previous - 1
  return {
    score: scoreFromChange(change),
    evidence: `Revenue over the last 12 months is ${percent(change)} vs the previous 12 months.`,
  }
}

// Orders placed in the last 90 days vs the same 90 days a year earlier
// (same season, so seasonal swings don't count as a change).
async function orderVelocity(dealerId, asOf) {
  const countOrders = (from, to) =>
    prisma.order.count({
      where: { dealerId, type: 'order', status: { notIn: ['draft', 'rejected', 'declined'] }, createdAt: { gte: from, lt: to } },
    })
  const lastYear = yearBefore(asOf)
  const [current, previous] = await Promise.all([
    countOrders(daysBefore(asOf, 90), asOf),
    countOrders(daysBefore(lastYear, 90), lastYear),
  ])
  if (previous === 0) return { score: null, evidence: 'Not enough history to compare order volume.' }
  const change = current / previous - 1
  return {
    score: scoreFromChange(change),
    evidence: `${current} orders in the last 90 days, ${percent(change)} vs the same period last year.`,
  }
}

// Share of the last 12 months' claims that were neither rejected nor left
// open longer than the aging threshold.
async function warrantyCompliance(dealerId, asOf) {
  const claims = await prisma.claim.findMany({
    where: { dealerId, filedAt: { gte: yearBefore(asOf), lt: asOf } },
    select: { stage: true, filedAt: true, resolvedAt: true },
  })
  if (claims.length === 0) return { score: 100, evidence: 'No warranty claims in the last 12 months.' }

  const problems = claims.filter((claim) => {
    const resolved = claim.resolvedAt && claim.resolvedAt <= asOf
    return resolved ? claim.stage === 'rejected' : daysSince(claim.filedAt, asOf) > CLAIM_AGING_DAYS
  }).length
  const good = claims.length - problems
  return {
    score: Math.round((good / claims.length) * 100),
    evidence: `${good} of ${claims.length} claims in the last 12 months were approved or are within ${CLAIM_AGING_DAYS} days.`,
  }
}

const COMPONENTS = [
  { key: 'revenueGrowth', label: 'Revenue Growth', compute: revenueGrowth },
  { key: 'orderVelocity', label: 'Order Velocity', compute: orderVelocity },
  { key: 'warrantyCompliance', label: 'Warranty Compliance', compute: warrantyCompliance },
]

// Component weights set by the dealer's manufacturer (FR-D360-6), or the
// defaults when the manufacturer has none. -> { revenueGrowth: 0.3, ... }
export async function getHealthScoreWeights(dealerId) {
  const rows = await prisma.healthScoreWeight.findMany({
    where: { manufacturer: { dealers: { some: { id: dealerId } } } },
    select: { component: true, weight: true },
  })
  const configured = Object.fromEntries(rows.map((row) => [row.component, row.weight]))
  return Object.fromEntries(
    Object.keys(HEALTH_SCORE_WEIGHTS).map((key) => [key, configured[key] ?? HEALTH_SCORE_WEIGHTS[key]]),
  )
}

// -> { score, components: [{ key, label, weight, score, evidence }] }
// Components without enough data (score null) are left out and the other
// weights are scaled up, so a new dealer is not penalised for missing history.
// The weights are normalised, so they need not add up to exactly 1.
export async function computeHealthScore(dealerId, asOf = new Date()) {
  const weights = await getHealthScoreWeights(dealerId)
  const components = await Promise.all(
    COMPONENTS.map(async ({ key, label, compute }) => ({
      key,
      label,
      weight: weights[key],
      ...(await compute(dealerId, asOf)),
    })),
  )

  const scored = components.filter((component) => component.score !== null)
  const totalWeight = scored.reduce((sum, component) => sum + component.weight, 0)
  const score =
    totalWeight === 0
      ? null
      : Math.round(scored.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight)

  return { score, components }
}
