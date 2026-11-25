// Inventory dashboard tests (GET /inventory/overview): pricing summary,
// last 3 complete months of sales, orders with the manufacturer and product
// insights, each checked against figures calculated independently from the
// raw records.
//
//   npm test
//
// Runs on a temporary copy of prisma/demo.db, so the working database is never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-inventory-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { getInventoryOverview, lastCompleteMonths, stockStatus } = await import('../src/services/inventoryService.js')

const DEALER = 'd-1001'
const NOW = new Date('2026-11-22T12:00:00Z')
const near = (a, b) => Math.abs(a - b) < 0.01

let overview
before(async () => {
  overview = await getInventoryOverview(DEALER, NOW)
})
after(async () => {
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Inventory overview', () => {
  test('uses the last 3 complete months (the current month is left out)', () => {
    assert.deepEqual(lastCompleteMonths(NOW), ['2026-08', '2026-09', '2026-10'])
    assert.deepEqual(lastCompleteMonths(new Date('2026-01-10T00:00:00Z')), ['2025-10', '2025-11', '2025-12'])
    assert.deepEqual(overview.months, ['2026-08', '2026-09', '2026-10'])
  })

  test('lists every product of the dealer with its stock status', async () => {
    const stock = await prisma.inventory.findMany({ where: { dealerId: DEALER } })
    assert.equal(overview.products.length, stock.length)
    for (const p of overview.products) assert.equal(p.status, stockStatus(p))
    assert.equal(stockStatus({ onHand: 0, reorderPoint: 5 }), 'out')
    assert.equal(stockStatus({ onHand: 5, reorderPoint: 5 }), 'low')
    assert.equal(stockStatus({ onHand: 6, reorderPoint: 5 }), 'ok')
  })

  test('pricing summary matches the stock records', async () => {
    const stock = await prisma.inventory.findMany({ where: { dealerId: DEALER }, include: { product: true } })
    // Selling price, from the raw sales to customers of the last 12 months
    // (Dec 2025 - Nov 2026); unsold products: base price x overall markup.
    const sales = await prisma.dealerSale.findMany({ where: { dealerId: DEALER, createdAt: { gte: new Date('2025-12-01T00:00:00Z') } } })
    const byProduct = new Map()
    for (const s of sales) {
      const t = byProduct.get(s.productId) ?? { units: 0, revenue: 0 }
      byProduct.set(s.productId, { units: t.units + s.quantity, revenue: t.revenue + s.quantity * s.sellingPrice })
    }
    const markup = sales.reduce((a, s) => a + s.quantity * s.sellingPrice, 0) / sales.reduce((a, s) => a + s.quantity * s.basePrice, 0)
    const sellOf = (r) => {
      const t = byProduct.get(r.productId)
      return Math.round((t ? t.revenue / t.units : r.product.unitPrice * markup) * 100) / 100
    }
    const value = stock.reduce((s, r) => s + r.onHand * sellOf(r), 0)
    const cost = stock.reduce((s, r) => s + r.onHand * r.product.unitPrice, 0)
    const incoming = stock.reduce((s, r) => s + r.onOrder * r.product.unitPrice, 0)
    const { pricing } = overview
    assert.ok(near(pricing.stockValue, value), `${pricing.stockValue} vs ${value}`)
    assert.ok(near(pricing.stockCost, cost))
    assert.ok(near(pricing.potentialMargin, value - cost))
    assert.ok(pricing.stockValue > pricing.stockCost, 'dealers sell above the base price')
    assert.ok(near(pricing.incomingValue, incoming))
    assert.equal(pricing.lowestPrice, Math.min(...stock.map(sellOf)))
    assert.equal(pricing.highestPrice, Math.max(...stock.map(sellOf)))
    for (const p of overview.products) assert.ok(p.sellingPrice > p.product.unitPrice, p.product.sku)
  })

  test('monthly units and revenue match the sales records', async () => {
    for (const m of overview.monthly) {
      const agg = await prisma.sale.aggregate({ where: { dealerId: DEALER, month: m.month }, _sum: { units: true, revenue: true } })
      assert.equal(m.units, agg._sum.units ?? 0, m.month)
      assert.ok(near(m.revenue, agg._sum.revenue ?? 0), m.month)
    }
  })

  test('sales history covers the last 12 complete months plus the current month', async () => {
    assert.equal(overview.salesMonths.length, 13)
    assert.deepEqual(overview.salesMonths.slice(0, 12), lastCompleteMonths(NOW, 12))
    assert.equal(overview.salesMonths.at(-1), NOW.toISOString().slice(0, 7))
    for (const [i, month] of overview.salesMonths.entries()) {
      const agg = await prisma.sale.aggregate({ where: { dealerId: DEALER, month }, _sum: { units: true } })
      const units = overview.products.reduce((s, p) => s + p.sales[i].units, 0)
      assert.equal(units, agg._sum.units ?? 0, month)
    }
    // The last 3 complete months match the recent-performance figures.
    for (const p of overview.products) assert.deepEqual(p.sales.slice(9, 12), p.monthly, p.product.sku)
  })

  test('open orders with the manufacturer are counted by step', async () => {
    const count = (status) => prisma.order.count({ where: { dealerId: DEALER, type: 'order', status } })
    assert.equal(overview.orders.awaitingApproval, await count('submitted'))
    assert.equal(overview.orders.quotesToAccept, await count('approved'))
    assert.equal(overview.orders.toFulfil, await count('accepted'))
    assert.equal(overview.orders.unitsOnOrder, overview.products.reduce((s, p) => s + p.onOrder, 0))
  })

  test('the best seller sold the most units in the 3 months', () => {
    const max = Math.max(...overview.products.map((p) => p.unitsSold))
    assert.equal(overview.insights.bestSeller.units, max)
  })

  test('slow movers are in stock with no sales; needs reorder are low or out with nothing on order', () => {
    const slow = overview.products.filter((p) => p.unitsSold === 0 && p.onHand > 0)
    assert.equal(overview.insights.slowMovers.count, slow.length)
    const reorder = overview.products.filter((p) => p.status !== 'ok' && p.onOrder === 0)
    assert.equal(overview.insights.needReorder.count, reorder.length)
  })
})
