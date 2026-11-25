import { prisma } from '../db/prisma.js'
import { badRequest, notFound } from '../utils/httpError.js'
import { DAY_MS } from '../utils/query.js'
import { logAudit } from './auditLog.js'
import { publishWarrantyEvent } from './liveEvents.js'

// Dealer claim insights for the manufacturer (shown on Order Approvals): finds
// dealers whose warranty claims look unusual compared with the rest of the
// network, and lets the manufacturer flag a dealer for investigation.
//
// Every rule compares the dealer with the network, so a big dealer is not
// flagged just for being big (rates are per 100 installed units).

const round1 = (value) => Math.round(value * 10) / 10
const round2 = (value) => Math.round(value * 100) / 100

// Thresholds of the rules (each flag's explanation quotes the numbers).
export const RULES = Object.freeze({
  highRate: 1.5, // claims per 100 units at least 1.5x the network rate
  recentMin: 3, // at least 3 claims in the last 90 days ...
  recentFactor: 2, // ... at a rate (per 100 units) at least 2x the network's in the same 90 days
  earlyDays: 30, // a claim filed within 30 days of install is "early"
  earlyShare: 0.25, // at least 25% of the dealer's claims are early (min. 2)
  highAmount: 1.25, // average claim amount at least 1.25x the network average
  highRejection: 0.25, // at least 25% of decided claims were rejected (min. 2)
})
const WEIGHTS = { highRate: 3, recent: 2, repeat: 2, early: 1, highAmount: 1, highRejection: 1 }

// Audit actions for the manual investigation flag.
const INVESTIGATE = 'claims.investigate'
const INVESTIGATION_CLOSED = 'claims.investigationClosed'

// high = investigate (strong or several signals), medium = watch (any signal).
const riskLevel = (score) => (score >= 4 ? 'high' : score >= 1 ? 'medium' : 'normal')
const OPEN_STAGES = ['submitted', 'underReview']

// -> { asOf, rules, network, dealers: [...], flaggedCount, underInvestigation }
// dealers sorted by risk score, highest first. Each dealer:
//   { id, name, region, tier, claims, units, ratePer100, rateVsNetwork, avgAmount, last90,
//     previous90, open, openValue, rejected, decided, repeatUnits, earlyClaims,
//     score, risk, flags: [{ key, label, detail }], recentClaims, investigation }
export async function getClaimInsights(manufacturerId, now = new Date()) {
  const ago = (days) => new Date(now.getTime() - days * DAY_MS)
  const dealers = await prisma.dealer.findMany({
    where: { manufacturerId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, region: true, tier: true },
  })
  const dealerIds = dealers.map((d) => d.id)

  const [claims, unitGroups, investigations] = await Promise.all([
    prisma.claim.findMany({
      where: { dealerId: { in: dealerIds }, filedAt: { lte: now } },
      orderBy: { filedAt: 'desc' },
      select: {
        id: true,
        dealerId: true,
        registrationId: true,
        serialNumber: true,
        amount: true,
        stage: true,
        filedAt: true,
        product: { select: { sku: true, name: true } },
        registration: { select: { installDate: true } },
      },
    }),
    prisma.warrantyRegistration.groupBy({ by: ['dealerId'], where: { dealerId: { in: dealerIds } }, _count: { _all: true } }),
    prisma.auditLog.findMany({
      where: { action: { in: [INVESTIGATE, INVESTIGATION_CLOSED] }, entity: 'Dealer', entityId: { in: dealerIds } },
      orderBy: { createdAt: 'desc' },
      select: { action: true, entityId: true, details: true, createdAt: true, user: { select: { name: true } } },
    }),
  ])
  const unitsOf = new Map(unitGroups.map((g) => [g.dealerId, g._count._all]))

  // Network figures: the yardstick for every dealer.
  const totalUnits = [...unitsOf.values()].reduce((a, b) => a + b, 0)
  const networkRate = totalUnits ? (claims.length / totalUnits) * 100 : 0
  const networkRecentRate = totalUnits ? (claims.filter((c) => c.filedAt >= ago(90)).length / totalUnits) * 100 : 0
  const networkAvgAmount = claims.length ? claims.reduce((s, c) => s + c.amount, 0) / claims.length : 0

  // The latest investigation action per dealer decides whether one is open.
  const latestInvestigation = new Map()
  for (const row of investigations) if (!latestInvestigation.has(row.entityId)) latestInvestigation.set(row.entityId, row)

  const result = dealers.map((dealer) => {
    const mine = claims.filter((c) => c.dealerId === dealer.id)
    const units = unitsOf.get(dealer.id) ?? 0
    const ratePer100 = units ? (mine.length / units) * 100 : 0
    const rateVsNetwork = networkRate ? ratePer100 / networkRate : 0
    const avgAmount = mine.length ? mine.reduce((s, c) => s + c.amount, 0) / mine.length : 0
    const last90 = mine.filter((c) => c.filedAt >= ago(90)).length
    const previous90 = mine.filter((c) => c.filedAt < ago(90) && c.filedAt >= ago(180)).length
    const recentRate = units ? (last90 / units) * 100 : 0
    const decided = mine.filter((c) => ['approved', 'reimbursed', 'rejected'].includes(c.stage)).length
    const rejected = mine.filter((c) => c.stage === 'rejected').length
    const open = mine.filter((c) => OPEN_STAGES.includes(c.stage))

    // Units with more than one claim.
    const perUnit = new Map()
    for (const c of mine) perUnit.set(c.registrationId, (perUnit.get(c.registrationId) ?? 0) + 1)
    const repeatIds = new Set([...perUnit.entries()].filter(([, n]) => n > 1).map(([id]) => id))
    const daysAfterInstall = (c) => Math.floor((c.filedAt - c.registration.installDate) / DAY_MS)
    const earlyClaims = mine.filter((c) => daysAfterInstall(c) <= RULES.earlyDays).length

    // The rules. Each flag explains itself in plain words.
    const flags = []
    if (mine.length >= 3 && rateVsNetwork >= RULES.highRate) {
      flags.push({
        key: 'highRate',
        label: 'High claim rate',
        detail: `${round1(ratePer100)} claims per 100 installed units, ${round1(rateVsNetwork)}× the network average (${round1(networkRate)}).`,
      })
    }
    if (last90 >= RULES.recentMin && networkRecentRate && recentRate / networkRecentRate >= RULES.recentFactor) {
      flags.push({
        key: 'recent',
        label: 'High recent activity',
        detail: `${last90} claims in the last 90 days (${round1(recentRate)} per 100 units), ${round1(recentRate / networkRecentRate)}× the network rate for the same period.`,
      })
    }
    if (repeatIds.size > 0) {
      flags.push({ key: 'repeat', label: 'Repeat claims', detail: `${repeatIds.size} unit${repeatIds.size === 1 ? '' : 's'} with more than one claim.` })
    }
    if (earlyClaims >= 2 && earlyClaims / mine.length >= RULES.earlyShare) {
      flags.push({
        key: 'early',
        label: 'Claims soon after install',
        detail: `${earlyClaims} of ${mine.length} claims were filed within ${RULES.earlyDays} days of installation.`,
      })
    }
    if (mine.length >= 3 && networkAvgAmount && avgAmount / networkAvgAmount >= RULES.highAmount) {
      flags.push({
        key: 'highAmount',
        label: 'High claim amounts',
        detail: `Average claim $${Math.round(avgAmount).toLocaleString('en-US')}, ${round1(avgAmount / networkAvgAmount)}× the network average ($${Math.round(networkAvgAmount).toLocaleString('en-US')}).`,
      })
    }
    if (rejected >= 2 && rejected / decided >= RULES.highRejection) {
      flags.push({
        key: 'highRejection',
        label: 'Many rejected claims',
        detail: `${rejected} of ${decided} decided claims were rejected (${Math.round((rejected / decided) * 100)}%).`,
      })
    }
    const score = flags.reduce((s, f) => s + WEIGHTS[f.key], 0)

    const inv = latestInvestigation.get(dealer.id)
    const investigation =
      inv && inv.action === INVESTIGATE
        ? { open: true, since: inv.createdAt, by: inv.user?.name ?? null, note: inv.details ? JSON.parse(inv.details).note ?? null : null }
        : null

    return {
      ...dealer,
      claims: mine.length,
      units,
      ratePer100: round2(ratePer100),
      rateVsNetwork: round2(rateVsNetwork),
      avgAmount: round2(avgAmount),
      last90,
      previous90,
      open: open.length,
      openValue: round2(open.reduce((s, c) => s + c.amount, 0)),
      rejected,
      decided,
      repeatUnits: repeatIds.size,
      earlyClaims,
      score,
      risk: riskLevel(score),
      flags,
      investigation,
      recentClaims: mine.slice(0, 8).map((c) => ({
        id: c.id,
        serialNumber: c.serialNumber,
        product: c.product,
        amount: c.amount,
        stage: c.stage,
        filedAt: c.filedAt,
        daysAfterInstall: daysAfterInstall(c),
        repeat: repeatIds.has(c.registrationId),
      })),
    }
  })

  result.sort((a, b) => b.score - a.score || b.ratePer100 - a.ratePer100)
  const openClaims = claims.filter((c) => OPEN_STAGES.includes(c.stage))

  return {
    asOf: now,
    rules: RULES,
    network: {
      dealers: dealers.length,
      claims: claims.length,
      units: totalUnits,
      ratePer100: round2(networkRate),
      avgAmount: round2(networkAvgAmount),
      openClaims: openClaims.length,
      openValue: round2(openClaims.reduce((s, c) => s + c.amount, 0)),
    },
    dealers: result,
    flaggedCount: result.filter((d) => d.risk !== 'normal').length,
    underInvestigation: result.filter((d) => d.investigation).length,
  }
}

// Flags a dealer of this manufacturer for investigation (or closes it).
// Recorded in the audit log, so who did it and when is kept.
export async function setInvestigation(user, dealerId, { open, note = null }) {
  const dealer = await prisma.dealer.findFirst({ where: { id: dealerId, manufacturerId: user.manufacturerId }, select: { id: true } })
  if (!dealer) throw notFound('Dealer not found in your network.')
  if (note && note.length > 300) throw badRequest('note must be at most 300 characters.')
  await logAudit({ userId: user.id, action: open ? INVESTIGATE : INVESTIGATION_CLOSED, entity: 'Dealer', entityId: dealer.id, details: note ? { note } : null })
  publishWarrantyEvent({ action: open ? 'investigation.opened' : 'investigation.closed', dealerId: dealer.id, by: user.id })
}
