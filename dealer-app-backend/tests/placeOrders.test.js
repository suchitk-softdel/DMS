// Tests for Place Orders (GET/POST /place-orders): the dealer sells its own
// stock to customers. Checks the rules (only available products, never more
// than on hand, selling price above the base price), that a sale takes the
// units off stock, role access and that a dealer only sees its own sales.
//
//   npm test
//
// Runs the real HTTP API on a temporary copy of prisma/demo.db, so the
// working database is never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'place-orders-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { createApp } = await import('../src/app.js')

let server
let base
let principal, sales, tech, principal2, desk

async function signIn(email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'demo123' }),
  })
  assert.equal(res.status, 200, `login ${email}`)
  const cookie = res.headers.get('set-cookie').split(';')[0]
  const call = async (method, url, body) => {
    const r = await fetch(`${base}${url}`, {
      method,
      headers: { cookie, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    })
    return { status: r.status, body: await r.json() }
  }
  return { user: await res.json(), get: (url) => call('GET', url), post: (url, body) => call('POST', url, body) }
}

before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://localhost:${server.address().port}/api`
  ;[principal, sales, tech, principal2, desk] = await Promise.all(
    ['dealer@demo.com', 'sales@demo.com', 'tech@demo.com', 'dealer2@demo.com', 'manufacturer@demo.com'].map(signIn),
  )
})

after(async () => {
  server.close()
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

// A product of the dealer with at least `min` units on hand.
async function productInStock(min = 3) {
  const { body } = await principal.get('/place-orders')
  const product = body.products.find((p) => p.available >= min)
  assert.ok(product, `a product with ${min}+ units on hand`)
  return product
}

const onHand = async (dealerId, productId) =>
  (await prisma.inventory.findUnique({ where: { dealerId_productId: { dealerId, productId } } })).onHand

describe('Place Orders: product list (GET /place-orders)', () => {
  test('lists every product with available quantity, base price and stock status', async () => {
    const res = await principal.get('/place-orders')
    assert.equal(res.status, 200)
    const stock = await prisma.inventory.findMany({ where: { dealerId: principal.user.dealerId }, include: { product: true } })
    assert.equal(res.body.products.length, stock.length)
    for (const p of res.body.products) {
      const row = stock.find((s) => s.productId === p.productId)
      assert.equal(p.available, row.onHand, p.sku)
      assert.equal(p.basePrice, row.product.unitPrice, p.sku)
      assert.ok(['ok', 'low', 'out'].includes(p.status), p.status)
      assert.equal(p.status === 'out', p.available === 0, p.sku)
    }
    assert.ok(Array.isArray(res.body.recent))
  })

  test('is open to every dealer user, not the manufacturer', async () => {
    assert.equal((await sales.get('/place-orders')).status, 200)
    assert.equal((await tech.get('/place-orders')).status, 200)
    assert.equal((await desk.get('/place-orders')).status, 403)
  })

  test('the module is in the Dealer role only', async () => {
    const roles = await (await fetch(`${base}/roles`)).json()
    const byId = Object.fromEntries(roles.map((r) => [r.id, r.permissions]))
    assert.ok(byId.dealer.includes('placeOrders'))
    assert.ok(!byId.manufacturer.includes('placeOrders'))
  })
})

describe('Place Orders: selling (POST /place-orders)', () => {
  test('sells at a higher price, takes the units off stock and shows the profit', async () => {
    const product = await productInStock(3)
    const dealerId = principal.user.dealerId
    const before = await onHand(dealerId, product.productId)
    const sellingPrice = Math.round((product.basePrice + 100) * 100) / 100

    const res = await principal.post('/place-orders', { productId: product.productId, quantity: 2, sellingPrice })
    assert.equal(res.status, 201)
    assert.equal(res.body.quantity, 2)
    assert.equal(res.body.basePrice, product.basePrice)
    assert.equal(res.body.sellingPrice, sellingPrice)
    assert.equal(res.body.total, Math.round(2 * sellingPrice * 100) / 100)
    assert.equal(res.body.profit, 200)
    assert.equal(res.body.soldBy, principal.user.name)
    assert.equal(await onHand(dealerId, product.productId), before - 2)

    // The list shows the new stock, the sale and the price used last time.
    const list = await principal.get('/place-orders')
    const after = list.body.products.find((p) => p.productId === product.productId)
    assert.equal(after.available, before - 2)
    assert.equal(after.lastSellingPrice, sellingPrice)
    assert.equal(list.body.recent[0].id, res.body.id)

    const audit = await prisma.auditLog.findFirst({ where: { action: 'sales.placed', entityId: String(res.body.id) } })
    assert.ok(audit, 'the sale is in the audit log')
  })

  test('a sale is revenue straight away: Home and the monthly summary go up by its total, cost by its base price', async () => {
    const product = await productInStock(1)
    const dealerId = principal.user.dealerId
    const month = new Date().toISOString().slice(0, 7)
    const summary = () => prisma.sale.aggregate({ where: { dealerId, month }, _sum: { revenue: true, cost: true } })
    const [before, homeBefore] = [await summary(), (await principal.get('/home')).body.kpis.revenueYtd.value]

    const res = await principal.post('/place-orders', { productId: product.productId, quantity: 1, sellingPrice: product.basePrice + 40 })
    assert.equal(res.status, 201)
    const after = await summary()
    assert.ok(Math.abs((after._sum.revenue ?? 0) - (before._sum.revenue ?? 0) - res.body.total) < 0.01)
    assert.ok(Math.abs((after._sum.cost ?? 0) - (before._sum.cost ?? 0) - product.basePrice) < 0.01)
    const homeAfter = (await principal.get('/home')).body.kpis.revenueYtd.value
    assert.ok(Math.abs(homeAfter - homeBefore - res.body.total) <= 1, `${homeBefore} + ${res.body.total} -> ${homeAfter}`)
  })

  test('refuses a selling price equal to or below the base price', async () => {
    const product = await productInStock(1)
    for (const sellingPrice of [product.basePrice, product.basePrice - 1]) {
      const res = await principal.post('/place-orders', { productId: product.productId, quantity: 1, sellingPrice })
      assert.equal(res.status, 400, String(sellingPrice))
      assert.match(res.body.message, /higher than the base price/)
    }
  })

  test('refuses more units than are available, and leaves the stock as it was', async () => {
    const product = await productInStock(1)
    const before = await onHand(principal.user.dealerId, product.productId)
    const res = await principal.post('/place-orders', { productId: product.productId, quantity: before + 1, sellingPrice: product.basePrice + 50 })
    assert.equal(res.status, 400)
    assert.match(res.body.message, new RegExp(`Only ${before} `))
    assert.equal(await onHand(principal.user.dealerId, product.productId), before)
  })

  test('refuses an out-of-stock product', async () => {
    const product = await productInStock(1)
    await prisma.inventory.update({
      where: { dealerId_productId: { dealerId: principal.user.dealerId, productId: product.productId } },
      data: { onHand: 0 },
    })
    const res = await principal.post('/place-orders', { productId: product.productId, quantity: 1, sellingPrice: product.basePrice + 50 })
    assert.equal(res.status, 400)
    assert.match(res.body.message, /out of stock/)
  })

  test('two sales at once never sell the same units twice', async () => {
    const product = await productInStock(1)
    const dealerId = principal.user.dealerId
    await prisma.inventory.update({ where: { dealerId_productId: { dealerId, productId: product.productId } }, data: { onHand: 1 } })
    const body = { productId: product.productId, quantity: 1, sellingPrice: product.basePrice + 10 }
    const results = await Promise.all([principal.post('/place-orders', body), sales.post('/place-orders', body)])
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400])
    assert.equal(await onHand(dealerId, product.productId), 0)
  })

  test('checks the request: whole quantity of at least 1, a price and a product', async () => {
    const product = await productInStock(1)
    const bad = [
      { productId: product.productId, quantity: 0, sellingPrice: product.basePrice + 1 },
      { productId: product.productId, quantity: 1.5, sellingPrice: product.basePrice + 1 },
      { productId: product.productId, quantity: 1, sellingPrice: 'high' },
      { quantity: 1, sellingPrice: product.basePrice + 1 },
    ]
    for (const body of bad) assert.equal((await principal.post('/place-orders', body)).status, 400, JSON.stringify(body))
    assert.equal((await principal.post('/place-orders', { productId: 'no-such-product', quantity: 1, sellingPrice: 10 })).status, 404)
  })

  test('the manufacturer cannot sell', async () => {
    const product = await productInStock(1)
    const body = { productId: product.productId, quantity: 1, sellingPrice: product.basePrice + 10 }
    assert.equal((await desk.post('/place-orders', body)).status, 403)
  })

  test("a dealer sells only its own stock and never sees another dealer's sales", async () => {
    const before = await principal2.get('/place-orders')
    assert.equal(before.status, 200)
    const product = before.body.products.find((p) => p.available >= 1)
    const res = await principal2.post('/place-orders', { productId: product.productId, quantity: 1, sellingPrice: product.basePrice + 25 })
    assert.equal(res.status, 201)
    // Stock of dealer 2 went down; dealer 1's stock of that product did not.
    assert.equal(await onHand(principal2.user.dealerId, product.productId), product.available - 1)
    const mine = await principal.get('/place-orders')
    assert.ok(!mine.body.recent.some((s) => s.id === res.body.id), "dealer 1 does not see dealer 2's sale")
  })
})
