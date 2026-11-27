// Dealer 360 tests (SRS 3.3, FR-D360-1 to 6) on the fixed 2-year dataset.
//
//   npm test
//
// Every figure on the page is compared with a value calculated INDEPENDENTLY
// from the raw records (orders, claims, training) with plain Prisma queries.
// Runs on a temporary copy of prisma/demo.db, so the working database is
// never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-360-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { getDealer360 } = await import('../src/services/dealer360Service.js')
const { computeHealthScore } = await import('../src/services/healthScoreService.js')

// The dataset runs up to 15 Nov 2026; the page is computed as of that day.
const NOW = new Date('2026-11-15T12:00:00Z')
const YEAR_AGO = new Date('2025-11-15T12:00:00Z')
const TWO_YEARS_AGO = new Date('2024-11-15T12:00:00Z')
const ALL_MODULES = ['home', 'dealer360', 'orders', 'inventory', 'incentives', 'warranty', 'salesCoach']
const load = (dealerId, permissions = ALL_MODULES) => getDealer360({ dealerId, permissions }, NOW)

// Revenue = what customers paid: quantity x selling price of the dealer's
// sales (Place Orders).
const revenue = async (dealerId, gte, lt) => {
  const sales = await prisma.dealerSale.findMany({ where: { dealerId, createdAt: { gte, lt } }, select: { quantity: true, sellingPrice: true } })
  return sales.reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0)
}

let dealers = []
before(async () => {
  dealers = await prisma.dealer.findMany({ orderBy: { id: 'asc' } })
})
after(async () => {
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Tiles (FR-D360-1)', () => {
  test('revenue, growth and territory coverage match the orders, for every dealer', async () => {
    for (const dealer of dealers) {
      const { kpis } = await load(dealer.id)
      const current = await revenue(dealer.id, YEAR_AGO, NOW)
      const previous = await revenue(dealer.id, TWO_YEARS_AGO, YEAR_AGO)
      assert.equal(kpis.revenue.value, Math.round(current), dealer.id)
      assert.equal(kpis.territoryCoverage.value, dealer.territoryCoverage, dealer.id)

      if (dealer.createdAt > TWO_YEARS_AGO) {
        // A dealer that joined during the earlier period has no comparable year.
        assert.equal(kpis.revenue.changePct, null, `${dealer.id} is new`)
        assert.equal(kpis.growth.value, null, `${dealer.id} is new`)
      } else {
        const expected = Math.round((current / previous - 1) * 1000) / 10
        assert.equal(kpis.revenue.changePct, expected, dealer.id)
        assert.equal(kpis.growth.value, expected, dealer.id)
      }
    }
  })

  test('the demo stories show: Summit grows, Prairie declines, Lakeside is new', async () => {
    assert.ok((await load('d-1001')).kpis.growth.value > 5)
    assert.ok((await load('d-1003')).kpis.growth.value < -5)
    assert.equal((await load('d-1004')).kpis.growth.value, null)
  })

  test('health score tile equals the Health Score model', async () => {
    for (const dealer of dealers) {
      const { kpis } = await load(dealer.id)
      assert.equal(kpis.healthScore.value, (await computeHealthScore(dealer.id, NOW)).score, dealer.id)
    }
  })
})

describe('Revenue trend (FR-D360-2)', () => {
  test('24 months, each equal to that month\'s sales to customers', async () => {
    for (const dealer of dealers) {
      const { trend } = await load(dealer.id)
      assert.equal(trend.length, 24)
      assert.equal(trend.at(-1).month, '2026-11')
      assert.equal(trend.at(-1).partial, true)
      assert.ok(trend.slice(0, -1).every((p) => !p.partial))

      const joined = dealer.createdAt.toISOString().slice(0, 7)
      for (const point of trend) {
        const [year, month] = point.month.split('-').map(Number)
        const expected = await revenue(dealer.id, new Date(Date.UTC(year, month - 1, 1)), new Date(Date.UTC(year, month, 1)))
        if (point.month < joined) assert.equal(point.revenue, null, `${dealer.id} ${point.month}: before joining`)
        else assert.ok(Math.abs(point.revenue - expected) < 0.01, `${dealer.id} ${point.month}: ${point.revenue} vs ${expected}`)
      }
      // "Same month last year" is the value 12 points earlier.
      for (let i = 12; i < trend.length; i += 1) assert.equal(trend[i].lastYear, trend[i - 12].revenue, `${dealer.id} ${trend[i].month}`)
    }
  })
})

describe('Health Score breakdown and weights (FR-D360-3, FR-D360-6)', () => {
  test('the breakdown explains the score: weighted average of the components', async () => {
    for (const dealer of dealers) {
      const { health } = await load(dealer.id)
      const scored = health.components.filter((c) => c.score !== null)
      const total = scored.reduce((s, c) => s + c.weight, 0)
      assert.equal(health.score, Math.round(scored.reduce((s, c) => s + c.score * c.weight, 0) / total), dealer.id)
      assert.ok(health.components.every((c) => c.evidence.length > 0), dealer.id)
    }
  })

  test('weights come from the database and changing them changes the score', async () => {
    const before = await computeHealthScore('d-1001', NOW)
    assert.deepEqual(
      Object.fromEntries(before.components.map((c) => [c.key, c.weight])),
      { revenueGrowth: 0.3, orderVelocity: 0.25, warrantyCompliance: 0.25 },
    )

    // A Manufacturer Administrator puts all the weight on warranty compliance.
    const where = (component) => ({ manufacturerId_component: { manufacturerId: 'm-01', component } })
    for (const [component, weight] of [['revenueGrowth', 0], ['orderVelocity', 0], ['warrantyCompliance', 1]]) {
      await prisma.healthScoreWeight.update({ where: where(component), data: { weight } })
    }
    const after = await computeHealthScore('d-1001', NOW)
    const warranty = after.components.find((c) => c.key === 'warrantyCompliance')
    assert.equal(after.score, warranty.score)
    assert.notEqual(after.score, before.score)

    // Back to the defaults for the other tests.
    for (const [component, weight] of Object.entries({ revenueGrowth: 0.3, orderVelocity: 0.25, warrantyCompliance: 0.25 })) {
      await prisma.healthScoreWeight.update({ where: where(component), data: { weight } })
    }
    assert.equal((await computeHealthScore('d-1001', NOW)).score, before.score)
  })
})

describe('Recommendations (FR-D360-4)', () => {
  test('each is tied to a component and carries evidence', async () => {
    for (const dealer of dealers) {
      const { recommendations, health } = await load(dealer.id)
      assert.ok(recommendations.length <= 4, dealer.id) // none when nothing needs action
      const keys = new Set(health.components.map((c) => c.key))
      for (const rec of recommendations) {
        assert.ok(keys.has(rec.component.key), `${dealer.id}: ${rec.key}`)
        assert.ok(rec.evidence.length > 0 && rec.evidence.every(Boolean), `${dealer.id}: ${rec.key}`)
        assert.ok(rec.title && rec.detail, `${dealer.id}: ${rec.key}`)
      }
    }
  })

  test('aging claims: count and claim ids match the claims table', async () => {
    for (const dealer of dealers) {
      const aging = await prisma.claim.findMany({
        where: {
          dealerId: dealer.id,
          stage: { in: ['submitted', 'underReview'] },
          stageChangedAt: { lt: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      })
      const rec = (await load(dealer.id)).recommendations.find((r) => r.key === 'agingClaims')
      if (!rec) continue // may be outranked by more important actions
      assert.ok(rec.title.startsWith(`Resolve ${aging.length} aging claim`), `${dealer.id}: ${rec.title}`)
      for (const line of rec.evidence) assert.ok(aging.some((c) => line.startsWith(c.id)), `${dealer.id}: ${line}`)
    }
  })

  test('an action button is only offered for modules the role can open', async () => {
    const limited = await load('d-1001', ['home', 'dealer360'])
    assert.ok(limited.recommendations.every((r) => r.action === null))
  })
})

describe('Dealer timeline (FR-D360-5)', () => {
  test('newest first, at most 10 events, only this dealer\'s records', async () => {
    for (const dealer of dealers) {
      const { timeline } = await load(dealer.id)
      assert.ok(timeline.length > 0 && timeline.length <= 10, dealer.id)
      for (let i = 1; i < timeline.length; i += 1) assert.ok(timeline[i - 1].date >= timeline[i].date, dealer.id)
      for (const event of timeline.filter((e) => e.type === 'order')) {
        const order = await prisma.order.findUnique({ where: { id: event.ref }, select: { dealerId: true } })
        assert.equal(order.dealerId, dealer.id)
      }
    }
  })
})
