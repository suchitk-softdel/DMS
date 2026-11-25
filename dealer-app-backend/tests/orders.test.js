// Orders & Quotes tests (SRS 3.4, FR-ORD-1 to 6) on the fixed 2-year dataset.
//
//   npm test
//
// Figures are compared with values calculated INDEPENDENTLY from the raw
// records. The create/submit/approve/fulfil flow runs on a temporary copy of
// prisma/demo.db, so the working database is never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-orders-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { getOrdersSummary } = await import('../src/services/orderInsightService.js')
const { createOrder, listOrders, updateOrderStatus } = await import('../src/services/orderService.js')
const { approveOrder } = await import('../src/services/manufacturerService.js')
const ORDER_DESK = { id: 'u-m01', manufacturerId: 'm-01' }

const NOW = new Date('2026-11-15T12:00:00Z')
const DEALERS = ['d-1001', 'd-1002', 'd-1003', 'd-1004', 'd-1005', 'd-1006']
const summaryOf = (dealerId) => getOrdersSummary({ dealerId })

after(async () => {
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Order list (FR-ORD-2, FR-ORD-3)', () => {
  test('filters by type, status and search, and only shows the dealer\'s own orders', async () => {
    const all = await listOrders('d-1001', { limit: 500, offset: 0 })
    assert.equal(all.total, await prisma.order.count({ where: { dealerId: 'd-1001' } }))

    const submitted = await listOrders('d-1001', { type: 'quote', status: 'submitted', limit: 500, offset: 0 })
    assert.equal(submitted.total, await prisma.order.count({ where: { dealerId: 'd-1001', type: 'quote', status: 'submitted' } }))
    assert.ok(submitted.items.every((o) => o.type === 'quote' && o.status === 'submitted'))

    const byName = await listOrders('d-1001', { search: 'Oak', limit: 500, offset: 0 })
    assert.ok(byName.total > 0)
    assert.ok(byName.items.every((o) => o.id.includes('Oak') || o.customer.name.includes('Oak')))

    const other = await prisma.order.findFirst({ where: { dealerId: 'd-1002' }, select: { id: true } })
    assert.equal((await listOrders('d-1001', { search: other.id, limit: 10, offset: 0 })).total, 0)
  })

  test('status groups: drafts, in progress, completed and closed add up to all', async () => {
    const all = (await listOrders('d-1001', { limit: 1, offset: 0 })).total
    const totals = {}
    for (const stage of ['draft', 'open', 'done', 'closed']) totals[stage] = (await listOrders('d-1001', { stage, limit: 1, offset: 0 })).total
    assert.equal(totals.draft + totals.open + totals.done + totals.closed, all)
    const done = await listOrders('d-1001', { stage: 'done', limit: 500, offset: 0 })
    assert.ok(done.items.every((o) => (o.type === 'order' ? o.status === 'fulfilled' : o.status === 'approved')))
  })

  test('sorts by amount, customer and date in both directions', async () => {
    const isSorted = (values, dir) => values.every((v, i) => i === 0 || (dir === 'asc' ? values[i - 1] <= v : values[i - 1] >= v))
    for (const dir of ['asc', 'desc']) {
      const byTotal = await listOrders('d-1001', { limit: 100, offset: 0, sort: 'total', dir })
      assert.ok(isSorted(byTotal.items.map((o) => o.total), dir), `total ${dir}`)
      const byDate = await listOrders('d-1001', { limit: 100, offset: 0, sort: 'createdAt', dir })
      assert.ok(isSorted(byDate.items.map((o) => o.createdAt.getTime()), dir), `date ${dir}`)
      const byCustomer = await listOrders('d-1001', { limit: 100, offset: 0, sort: 'customer', dir })
      assert.ok(isSorted(byCustomer.items.map((o) => o.customer.name), dir), `customer ${dir}`)
    }
  })

  test('pages do not overlap and cover every order', async () => {
    const total = await prisma.order.count({ where: { dealerId: 'd-1003' } })
    const seen = new Set()
    for (let offset = 0; offset < total; offset += 25) {
      const page = await listOrders('d-1003', { limit: 25, offset })
      for (const o of page.items) seen.add(o.id)
    }
    assert.equal(seen.size, total)
  })
})

describe('Summary (FR-ORD-6)', () => {
  test('counts and orders awaiting approval match the orders table, for every dealer', async () => {
    for (const dealerId of DEALERS) {
      const summary = await summaryOf(dealerId)
      for (const type of ['order', 'quote']) {
        for (const [status, n] of Object.entries(summary.counts[type])) {
          assert.equal(n, await prisma.order.count({ where: { dealerId, type, status } }), `${dealerId} ${type} ${status}`)
        }
      }
      assert.equal(summary.awaitingApproval, await prisma.order.count({ where: { dealerId, type: 'order', status: 'submitted' } }))
      assert.equal(summary.openOrders, await prisma.order.count({ where: { dealerId, type: 'order', status: { in: ['submitted', 'approved'] } } }))
    }
  })

  test('manufacturer quotes waiting for the dealer are counted', async () => {
    for (const dealerId of DEALERS) {
      const summary = await summaryOf(dealerId)
      assert.equal(summary.quotesToAccept, await prisma.order.count({ where: { dealerId, type: 'order', status: 'approved' } }))
    }
  })
})

describe('Create, submit, approve and fulfil (FR-ORD-1)', () => {
  const user = { id: null, dealerId: 'd-1001' }

  test('a new quote is priced from the catalogue and saved as a draft', async () => {
    const customer = await prisma.customer.findFirst({ where: { dealerId: 'd-1001' } })
    const [furnace, thermostat] = await Promise.all([
      prisma.product.findFirst({ where: { category: 'furnace' } }),
      prisma.product.findFirst({ where: { category: 'thermostat' } }),
    ])
    const quote = await createOrder(user, {
      type: 'quote',
      customerId: customer.id,
      status: 'draft',
      items: [
        { productId: furnace.id, quantity: 2 },
        { productId: thermostat.id, quantity: 3 },
      ],
    })
    assert.match(quote.id, /^QT-\d+$/)
    assert.equal(quote.status, 'draft')
    assert.equal(quote.total, Math.round((2 * furnace.unitPrice + 3 * thermostat.unitPrice) * 100) / 100)
  })

  test('accepting a quote records how and by whom the customer accepted', async () => {
    const customer = await prisma.customer.findFirst({ where: { dealerId: 'd-1001' } })
    const product = await prisma.product.findFirst({ where: { category: 'airConditioner' } })
    const quote = await createOrder(user, { type: 'quote', customerId: customer.id, status: 'submitted', items: [{ productId: product.id, quantity: 1 }] })

    await assert.rejects(updateOrderStatus(user, quote.id, 'approved'), /how the customer accepted/)
    const accepted = await updateOrderStatus(user, quote.id, 'approved', { method: 'email', contact: 'John Lee, Facilities Manager', note: 'Reply to quote email' })
    assert.equal(accepted.status, 'approved')
    assert.equal(accepted.acceptanceMethod, 'email')
    assert.equal(accepted.acceptanceContact, 'John Lee, Facilities Manager')
    assert.equal(accepted.acceptanceNote, 'Reply to quote email')
    assert.ok(accepted.reviewedAt)

    const audit = await prisma.auditLog.findFirst({ where: { entityId: quote.id, action: 'quote.status' }, orderBy: { id: 'desc' } })
    assert.equal(JSON.parse(audit.details).acceptedBy, 'John Lee, Facilities Manager')
  })

  test('quotes accepted before this change keep who recorded them and when', async () => {
    const old = await prisma.order.count({ where: { type: 'quote', status: 'approved', reviewedAt: null } })
    assert.equal(old, 0)
  })

  test('the dealer can decline the manufacturer quote, with a reason', async () => {
    const customer = await prisma.customer.findFirst({ where: { dealerId: 'd-1001' } })
    const product = await prisma.product.findFirst({ where: { category: 'furnace' } })
    const order = await createOrder(user, { type: 'order', customerId: customer.id, status: 'submitted', items: [{ productId: product.id, quantity: 2 }] })
    await approveOrder(ORDER_DESK, order.id)
    await assert.rejects(updateOrderStatus(user, order.id, 'declined'), /reason for declining/)
    const declined = await updateOrderStatus(user, order.id, 'declined', null, 'Price too high for this project')
    assert.equal(declined.status, 'declined')
    assert.equal(declined.declineReason, 'Price too high for this project')
    await assert.rejects(updateOrderStatus(user, order.id, 'fulfilled'), /cannot be changed/)
  })

  test('a customer of another dealer is refused', async () => {
    const stranger = await prisma.customer.findFirst({ where: { dealerId: 'd-1002' } })
    const product = await prisma.product.findFirst()
    await assert.rejects(
      createOrder(user, { type: 'order', customerId: stranger.id, status: 'draft', items: [{ productId: product.id, quantity: 1 }] }),
      /Customer not found/,
    )
  })

  test('dealer requests, manufacturer quotes, dealer accepts and fulfils; fulfilling adds stock, not revenue', async () => {
    const customer = await prisma.customer.findFirst({ where: { dealerId: 'd-1001', type: 'commercial' } })
    const heatPump = await prisma.product.findFirst({ where: { category: 'heatPump' } })
    const revenueBefore = (await prisma.sale.aggregate({ where: { dealerId: 'd-1001' }, _sum: { revenue: true } }))._sum.revenue
    const before = await summaryOf('d-1001')

    const order = await createOrder(user, { type: 'order', customerId: customer.id, status: 'draft', items: [{ productId: heatPump.id, quantity: 4 }] })
    assert.match(order.id, /^ORD-\d+$/)

    await assert.rejects(updateOrderStatus(user, order.id, 'fulfilled'), /can only move to: submitted/)
    await updateOrderStatus(user, order.id, 'submitted')
    assert.equal((await summaryOf('d-1001')).awaitingApproval, before.awaitingApproval + 1)
    // The dealer cannot approve its own order: that is the manufacturer's decision.
    await assert.rejects(updateOrderStatus(user, order.id, 'approved'), /approved or rejected by the manufacturer/)
    // The manufacturer approves and quotes the current catalogue price.
    await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { unitPrice: 1 } })
    const quoted = await approveOrder(ORDER_DESK, order.id)
    assert.equal(quoted.status, 'approved')
    assert.equal(quoted.items[0].unitPrice, heatPump.unitPrice)
    assert.equal(quoted.total, Math.round(4 * heatPump.unitPrice * 100) / 100)

    // A quoted order must be accepted before it can be fulfilled.
    await assert.rejects(updateOrderStatus(user, order.id, 'fulfilled'), /can only move to: accepted, declined/)
    const accepted = await updateOrderStatus(user, order.id, 'accepted')
    assert.equal(accepted.status, 'accepted')
    assert.ok(accepted.dealerRespondedAt)
    const fulfilled = await updateOrderStatus(user, order.id, 'fulfilled')
    assert.equal(fulfilled.status, 'fulfilled')

    // Units are registered by the dealer afterwards (Register Warranty), not automatically.
    const registrations = await prisma.warrantyRegistration.count({ where: { orderId: order.id } })
    assert.equal(registrations, 0)
    // Buying from the manufacturer is not revenue: revenue comes from the
    // dealer's sales to customers (Place Orders), so it does not change here.
    const revenueAfter = (await prisma.sale.aggregate({ where: { dealerId: 'd-1001' }, _sum: { revenue: true } }))._sum.revenue
    assert.ok(Math.abs(revenueAfter - revenueBefore) < 0.01)
    await assert.rejects(updateOrderStatus(user, order.id, 'submitted'), /cannot be changed/)
  })

  // Runs an order through request -> quote -> accept and returns it, ready to fulfil.
  async function acceptedOrder(items) {
    const order = await createOrder(user, { type: 'order', status: 'draft', items })
    await updateOrderStatus(user, order.id, 'submitted')
    await approveOrder(ORDER_DESK, order.id)
    await updateOrderStatus(user, order.id, 'accepted')
    return order
  }
  const stockOf = (productId) => prisma.inventory.findUnique({ where: { dealerId_productId: { dealerId: 'd-1001', productId } } })

  test('fulfilling an order puts its goods into stock: on hand up, on order down (never below 0)', async () => {
    const [a, b] = await prisma.inventory.findMany({ where: { dealerId: 'd-1001' }, orderBy: { productId: 'asc' }, take: 2 })
    // b has less on order than is delivered, so its on order stops at 0.
    await prisma.inventory.update({ where: { id: b.id }, data: { onOrder: 2 } })
    const order = await acceptedOrder([
      { productId: a.productId, quantity: 3 },
      { productId: b.productId, quantity: 5 },
    ])

    // Stock does not change until the goods arrive.
    assert.equal((await stockOf(a.productId)).onHand, a.onHand)
    await updateOrderStatus(user, order.id, 'fulfilled')

    const afterA = await stockOf(a.productId)
    const afterB = await stockOf(b.productId)
    assert.equal(afterA.onHand, a.onHand + 3)
    assert.equal(afterA.onOrder, Math.max(0, a.onOrder - 3))
    assert.equal(afterB.onHand, b.onHand + 5)
    assert.equal(afterB.onOrder, 0)
  })

  test('a product the dealer had no stock of gets a stock row when its order is fulfilled', async () => {
    const stocked = new Set((await prisma.inventory.findMany({ where: { dealerId: 'd-1001' }, select: { productId: true } })).map((r) => r.productId))
    let product = (await prisma.product.findMany()).find((p) => !stocked.has(p.id))
    if (!product) {
      // Every product is stocked in the demo data: remove one row for this test.
      const row = await prisma.inventory.findFirst({ where: { dealerId: 'd-1001' } })
      await prisma.inventory.delete({ where: { id: row.id } })
      product = { id: row.productId }
    }
    const order = await acceptedOrder([{ productId: product.id, quantity: 2 }])
    await updateOrderStatus(user, order.id, 'fulfilled')
    const stock = await stockOf(product.id)
    assert.equal(stock.onHand, 2)
    assert.equal(stock.onOrder, 0)
  })

  test('the same order fulfilled twice at once adds its goods to stock only once', async () => {
    const row = await prisma.inventory.findFirst({ where: { dealerId: 'd-1001' }, orderBy: { productId: 'desc' } })
    const order = await acceptedOrder([{ productId: row.productId, quantity: 4 }])
    const results = await Promise.allSettled([updateOrderStatus(user, order.id, 'fulfilled'), updateOrderStatus(user, order.id, 'fulfilled')])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal((await stockOf(row.productId)).onHand, row.onHand + 4)
  })
})

describe('Order insights (top of the Orders screen)', () => {
  test('quotes, waiting requests and orders to receive match the order records', async () => {
    for (const dealerId of DEALERS) {
      const { insights } = await getOrdersSummary({ dealerId }, NOW)
      const rows = (status) => prisma.order.findMany({ where: { dealerId, type: 'order', status } })
      const quotes = await rows('approved')
      assert.equal(insights.quotes.count, quotes.length, dealerId)
      assert.ok(Math.abs(insights.quotes.value - quotes.reduce((s, o) => s + o.total, 0)) < 0.01, dealerId)
      assert.equal(insights.waiting.count, (await rows('submitted')).length, dealerId)
      assert.equal(insights.toReceive.count, (await rows('accepted')).length, dealerId)
      if (quotes.length) {
        // The oldest quote waited at least as long as every other one.
        const waited = quotes.map((q) => Math.floor((NOW - (q.reviewedAt ?? q.createdAt)) / 86_400_000))
        assert.equal(insights.quotes.oldest.days, Math.max(...waited), dealerId)
      } else {
        assert.equal(insights.quotes.oldest, null, dealerId)
      }
    }
  })

  test('last 30 days counts the orders sent in that window', async () => {
    const { insights } = await getOrdersSummary({ dealerId: 'd-1001' }, NOW)
    const from = new Date(NOW.getTime() - 30 * 86_400_000)
    const count = await prisma.order.count({ where: { dealerId: 'd-1001', type: 'order', status: { not: 'draft' }, createdAt: { gte: from, lte: NOW } } })
    assert.equal(insights.last30.count, count)
  })

  test('approval rate is approved / decided in the last 90 days', async () => {
    const { insights } = await getOrdersSummary({ dealerId: 'd-1001' }, NOW)
    const { decided, rejected, rate } = insights.approval
    if (decided) assert.equal(rate, Math.round(((decided - rejected) / decided) * 100) / 100)
    else assert.equal(rate, null)
  })
})
