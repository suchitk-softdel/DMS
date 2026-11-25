// Manufacturer order approval tests: dealers send orders, the manufacturer's
// order desk approves or rejects them (with a reason), the dealer fulfils.
//
//   npm test
//
// Runs the real HTTP API (login, cookies, role checks) on a temporary copy of
// prisma/demo.db, so the working database is never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-manufacturer-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { createApp } = await import('../src/app.js')

let server
let base
before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(async () => {
  server.close()
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

// Signs in and returns a small client that sends the session cookie.
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
    return { status: r.status, body: r.status === 204 ? null : await r.json() }
  }
  return { user: await res.json(), get: (url) => call('GET', url), post: (url, body) => call('POST', url, body), patch: (url, body) => call('PATCH', url, body) }
}

async function newSubmittedOrder(dealer) {
  const customer = await prisma.customer.findFirst({ where: { dealerId: dealer.user.dealerId } })
  const product = await prisma.product.findFirst({ where: { category: 'furnace' } })
  const res = await dealer.post('/orders', { type: 'order', customerId: customer.id, status: 'submitted', items: [{ productId: product.id, quantity: 3 }] })
  assert.equal(res.status, 201)
  return res.body
}

describe('Who can see and do what', () => {
  test('the manufacturer login belongs to Aerovance, not to a dealer', async () => {
    const desk = await signIn('manufacturer@demo.com')
    assert.equal(desk.user.dealerId, null)
    assert.equal(desk.user.manufacturerId, 'm-01')
    assert.equal(desk.user.roleId, 'manufacturer')
  })

  test('only the manufacturer can open Order Approvals', async () => {
    for (const email of ['principal@demo.com', 'sales@demo.com', 'tech@demo.com']) {
      const dealer = await signIn(email)
      assert.equal((await dealer.get('/manufacturer/orders')).status, 403, email)
      assert.equal((await dealer.get('/manufacturer/orders/summary')).status, 403, email)
    }
    const desk = await signIn('manufacturer@demo.com')
    assert.equal((await desk.get('/manufacturer/orders')).status, 200)
  })

  test('the manufacturer cannot open dealer pages or dealer data', async () => {
    const desk = await signIn('manufacturer@demo.com')
    for (const url of ['/home', '/orders', '/dealer360', '/claims', '/customers']) {
      assert.equal((await desk.get(url)).status, 403, url)
    }
  })
})

describe('Network Copilot (manufacturer)', () => {
  const NETWORK = { manufacturerId: 'm-01' }
  const ask = async (client, question, context = null) => {
    const res = await client.post('/copilot/ask', { question, context })
    assert.equal(res.status, 200, question)
    return res.body
  }
  const dollars = (text) => Number(String(text).replace(/[^0-9.]/g, ''))

  test('answers over every dealer of the network, broken down by dealer', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const dealers = await prisma.dealer.findMany({ where: NETWORK })
    const answer = await ask(desk, 'revenue by dealer last year')
    assert.deepEqual(answer.table.columns.slice(0, 2), ['Dealer', 'Revenue'])
    assert.equal(answer.table.rows.length, dealers.length)
    assert.ok(answer.controls.find((c) => c.key === 'groupBy').options.some((o) => o.value === 'dealer'))

    // Each dealer's row = its own sales to customers in 2025.
    const sales = await prisma.dealerSale.findMany({
      where: { dealer: NETWORK, createdAt: { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2026-01-01T00:00:00Z') } },
      include: { dealer: { select: { name: true } } },
    })
    for (const [name, value] of answer.table.rows) {
      const expected = sales.filter((s) => s.dealer.name === name).reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0)
      assert.equal(dollars(value), Math.round(expected), name)
    }
  })

  test('one dealer by its short name, with the dealer in the records', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const answer = await ask(desk, 'revenue for Lone Star last year')
    assert.ok(answer.text.startsWith("Lone Star Air & Heat's revenue in 2025"), answer.text)
    assert.ok(answer.tags.includes('Lone Star Air & Heat'))

    const records = await desk.post('/copilot/records', { context: answer.context })
    assert.equal(records.status, 200)
    assert.equal(records.body.columns[1], 'Dealer')
    assert.ok(records.body.rows.length > 0)
    assert.ok(records.body.rows.every((row) => row[1] === 'Lone Star Air & Heat'))

    // A filter chip re-runs it over the same dealer.
    const rerun = await desk.post('/copilot/rerun', { context: answer.context, change: { metric: 'profit' } })
    assert.equal(rerun.status, 200)
    assert.ok(rerun.body.text.startsWith("Lone Star Air & Heat's profit"), rerun.body.text)
  })

  test('network totals, Health Scores and the dealer list', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const claims = await ask(desk, 'how many warranty claims last year')
    const expected = await prisma.claim.count({
      where: { dealer: NETWORK, filedAt: { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2026-01-01T00:00:00Z') } },
    })
    assert.ok(claims.text.startsWith(`Your dealers had ${expected} claim`), claims.text)

    const health = await ask(desk, "how are my dealers' health scores")
    assert.equal(health.understood, 'Health Score · all dealers')
    assert.equal(health.table.rows.length, await prisma.dealer.count({ where: NETWORK }))

    const list = await ask(desk, 'how many dealers are in my network')
    assert.equal(list.understood, 'Dealer network')

    // Stock belongs to each dealer.
    const stock = await ask(desk, 'what should I reorder')
    assert.match(stock.text, /managed by each dealer/)
  })

  test('a dealer user still only sees its own data (no "by dealer")', async () => {
    const principal = await signIn('principal@demo.com')
    const answer = await ask(principal, 'revenue by dealer last year')
    assert.ok(!answer.table || answer.table.columns[0] !== 'Dealer')
    assert.ok(!answer.controls?.find((c) => c.key === 'groupBy')?.options.some((o) => o.value === 'dealer'))
    const own = await ask(principal, 'total revenue last year')
    const records = await principal.post('/copilot/records', { context: own.context })
    assert.notEqual(records.body.columns[1], 'Dealer')
    // Tampering with the context cannot add a "by dealer" breakdown.
    const rerun = await principal.post('/copilot/rerun', { context: own.context, change: { groupBy: 'dealer' } })
    assert.equal(rerun.status, 400)
  })
})

describe('Order Approvals', () => {
  test('pending queue: every submitted order of the network, oldest first, matching the summary', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const { body: list } = await desk.get('/manufacturer/orders?queue=pending&limit=200')
    const expected = await prisma.order.count({ where: { type: 'order', status: 'submitted', dealer: { manufacturerId: 'm-01' } } })
    assert.equal(list.total, expected)
    assert.ok(list.items.every((o) => o.status === 'submitted'))
    assert.ok(list.items.every((o, i) => i === 0 || new Date(list.items[i - 1].createdAt) <= new Date(o.createdAt)))

    const { body: summary } = await desk.get('/manufacturer/orders/summary')
    assert.equal(summary.pending.count, expected)
    assert.equal(summary.dealers.reduce((sum, d) => sum + d.pending, 0), expected)
    const value = list.items.reduce((sum, o) => sum + o.total, 0)
    assert.ok(Math.abs(summary.pending.value - value) < 0.01)
  })

  test('filter by dealer', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const { body } = await desk.get('/manufacturer/orders?queue=approved&dealerId=d-1001&limit=200')
    assert.ok(body.items.every((o) => o.dealer.id === 'd-1001' && o.status === 'approved'))
  })

  test('dealer requests -> manufacturer quotes -> dealer accepts -> dealer fulfils', async () => {
    const dealer = await signIn('principal@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    const order = await newSubmittedOrder(dealer)

    // The dealer cannot approve its own order.
    const self = await dealer.patch(`/orders/${order.id}/status`, { status: 'approved' })
    assert.equal(self.status, 403)

    // It appears in the manufacturer's pending queue.
    const { body: pending } = await desk.get(`/manufacturer/orders?queue=pending&search=${order.id}`)
    assert.equal(pending.items[0]?.id, order.id)

    const approved = await desk.post(`/manufacturer/orders/${order.id}/approve`)
    assert.equal(approved.status, 200)
    assert.equal(approved.body.status, 'approved')
    assert.equal(approved.body.reviewedBy.name, 'Olivia Bennett')

    // Deciding twice is refused.
    assert.equal((await desk.post(`/manufacturer/orders/${order.id}/reject`, { reason: 'Changed my mind' })).status, 400)

    // The dealer sees the quote, accepts it and fulfils the order.
    const { body: seen } = await dealer.get(`/orders/${order.id}`)
    assert.equal(seen.status, 'approved')
    assert.ok(seen.reviewedAt)
    assert.equal((await dealer.patch(`/orders/${order.id}/status`, { status: 'fulfilled' })).status, 400)
    assert.equal((await dealer.patch(`/orders/${order.id}/status`, { status: 'accepted' })).status, 200)
    const { body: accepted } = await desk.get('/manufacturer/orders?queue=accepted&search=' + order.id)
    assert.equal(accepted.items[0]?.id, order.id)
    const fulfilled = await dealer.patch(`/orders/${order.id}/status`, { status: 'fulfilled' })
    assert.equal(fulfilled.status, 200)
    // Units are registered by the dealer afterwards (Register Warranty), not automatically.
    assert.equal(await prisma.warrantyRegistration.count({ where: { orderId: order.id } }), 0)
  })

  test('reject needs a reason, and the dealer sees it', async () => {
    const dealer = await signIn('sales@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    const order = await newSubmittedOrder(dealer)

    assert.equal((await desk.post(`/manufacturer/orders/${order.id}/reject`, { reason: '  ' })).status, 400)
    const rejected = await desk.post(`/manufacturer/orders/${order.id}/reject`, { reason: 'Credit hold: overdue invoices' })
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.status, 'rejected')

    const { body: seen } = await dealer.get(`/orders/${order.id}`)
    assert.equal(seen.status, 'rejected')
    assert.equal(seen.rejectionReason, 'Credit hold: overdue invoices')
    // A rejected order is final for the dealer.
    assert.equal((await dealer.patch(`/orders/${order.id}/status`, { status: 'fulfilled' })).status, 400)
    // It counts as neither open nor revenue, and shows in the manufacturer's closed list.
    const { body: summary } = await dealer.get('/orders/summary')
    assert.equal(summary.counts.order.rejected, 1)
    const { body: closed } = await desk.get('/manufacturer/orders?queue=closed&search=' + order.id)
    assert.equal(closed.items[0]?.id, order.id)
  })

  test('an order request needs no customer, and the API only creates orders', async () => {
    const dealer = await signIn('sales@demo.com')
    const product = await prisma.product.findFirst()
    const res = await dealer.post('/orders', { type: 'quote', status: 'submitted', items: [{ productId: product.id, quantity: 2 }] })
    assert.equal(res.status, 201)
    assert.equal(res.body.type, 'order')
    assert.equal(res.body.customer, null)
    assert.match(res.body.id, /^ORD-/)
  })

  test('only submitted orders can be decided, and only within the network', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const draft = await prisma.order.findFirst({ where: { type: 'order', status: 'fulfilled' } })
    assert.equal((await desk.post(`/manufacturer/orders/${draft.id}/approve`)).status, 400)
    assert.equal((await desk.post('/manufacturer/orders/ORD-999999/approve')).status, 404)
  })
})

describe('Dealer claim insights (on Order Approvals)', () => {
  test('only the manufacturer can see them; rates are claims per 100 installed units', async () => {
    const dealer = await signIn('principal@demo.com')
    assert.equal((await dealer.get('/manufacturer/claim-insights')).status, 403)

    const desk = await signIn('manufacturer@demo.com')
    const { status, body } = await desk.get('/manufacturer/claim-insights')
    assert.equal(status, 200)
    const dealerIds = (await prisma.dealer.findMany({ where: { manufacturerId: 'm-01' }, select: { id: true } })).map((d) => d.id)
    assert.equal(body.dealers.length, dealerIds.length)
    assert.equal(body.network.claims, await prisma.claim.count({ where: { dealerId: { in: dealerIds } } }))
    assert.equal(body.network.units, await prisma.warrantyRegistration.count({ where: { dealerId: { in: dealerIds } } }))
    for (const d of body.dealers) {
      if (d.units) assert.ok(Math.abs(d.ratePer100 - (d.claims / d.units) * 100) < 0.01, d.id)
      for (const f of d.flags) assert.ok(f.label && f.detail, `${d.id} ${f.key}`)
    }
  })

  test('the high-rate flag follows the rule; dealers are sorted by risk', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const { body } = await desk.get('/manufacturer/claim-insights')
    for (const d of body.dealers) {
      assert.equal(d.flags.some((f) => f.key === 'highRate'), d.claims >= 3 && d.rateVsNetwork >= body.rules.highRate - 0.005, d.id)
      assert.equal(d.risk, d.score >= 4 ? 'high' : d.score >= 1 ? 'medium' : 'normal', d.id)
    }
    const scores = body.dealers.map((d) => d.score)
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a))
    assert.equal(body.flaggedCount, body.dealers.filter((d) => d.risk !== 'normal').length)
  })

  test('a dealer can be flagged for investigation and the flag closed again', async () => {
    const desk = await signIn('manufacturer@demo.com')
    const { body } = await desk.get('/manufacturer/claim-insights')
    const target = body.dealers[0]
    const opened = await desk.post(`/manufacturer/claim-insights/dealers/${target.id}/investigation`, { open: true, note: 'Check the last claims' })
    assert.equal(opened.status, 200)
    const flagged = opened.body.dealers.find((d) => d.id === target.id)
    assert.equal(flagged.investigation.note, 'Check the last claims')
    assert.equal(opened.body.underInvestigation, 1)
    const closed = await desk.post(`/manufacturer/claim-insights/dealers/${target.id}/investigation`, { open: false })
    assert.equal(closed.body.dealers.find((d) => d.id === target.id).investigation, null)
    assert.equal((await desk.post('/manufacturer/claim-insights/dealers/d-unknown/investigation', { open: true })).status, 404)
    assert.equal((await desk.post(`/manufacturer/claim-insights/dealers/${target.id}/investigation`, { open: 'yes' })).status, 400)
  })
})
