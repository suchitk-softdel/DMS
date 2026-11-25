// Warranty tests (SRS 3.7, FR-WAR-1): register installed units and submit
// claims. The serial number (next SN) and install date (today) are set by the system. Every product has a
// 1-year warranty by default; a claim for a unit whose warranty has expired is
// refused by the backend.
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
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-warranty-test-'))
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
  return { cookie, user: await res.json(), get: (url) => call('GET', url), post: (url, body) => call('POST', url, body), patch: (url, body) => call('PATCH', url, body) }
}

const today = () => new Date().toISOString().slice(0, 10)

// Highest SN number in the database (serial numbers are SN + a number).
async function highestSerial() {
  const [{ maxSerial }] = await prisma.$queryRaw`
    SELECT MAX(CAST(substr(serialNumber, 3) AS INTEGER)) AS maxSerial
    FROM "WarrantyRegistration" WHERE serialNumber GLOB 'SN[0-9]*'`
  return Number(maxSerial)
}

// A fulfilled order with 2 furnaces and 1 thermostat (not serialised equipment).
async function fulfilledOrder(dealer, desk) {
  const furnace = await prisma.product.findFirst({ where: { category: 'furnace' }, orderBy: { sku: 'asc' } })
  const thermostat = await prisma.product.findFirst({ where: { category: 'thermostat' } })
  const created = await dealer.post('/orders', {
    type: 'order',
    status: 'submitted',
    items: [
      { productId: furnace.id, quantity: 2 },
      { productId: thermostat.id, quantity: 1 },
    ],
  })
  assert.equal(created.status, 201)
  const order = created.body
  assert.equal((await desk.post(`/manufacturer/orders/${order.id}/approve`)).status, 200)
  assert.equal((await dealer.patch(`/orders/${order.id}/status`, { status: 'accepted' })).status, 200)
  assert.equal((await dealer.patch(`/orders/${order.id}/status`, { status: 'fulfilled' })).status, 200)
  const lines = await prisma.orderItem.findMany({ where: { orderId: order.id } })
  return { order, furnace, line: lines.find((l) => l.productId === furnace.id), thermostatLine: lines.find((l) => l.productId === thermostat.id) }
}

describe('Warranty period', () => {
  test('every product has a 1-year warranty by default', async () => {
    const products = await prisma.product.findMany({ select: { warrantyYears: true } })
    assert.ok(products.length > 0)
    assert.ok(products.every((p) => p.warrantyYears === 1))
  })
})

describe('Register Warranty', () => {
  let dealer
  let setup
  before(async () => {
    dealer = await signIn('principal@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    setup = await fulfilledOrder(dealer, desk)
  })

  test('fulfilling an order does not register units by itself', async () => {
    assert.equal(await prisma.warrantyRegistration.count({ where: { orderId: setup.order.id } }), 0)
  })

  test('units waiting for registration list only the equipment lines', async () => {
    const { status, body } = await dealer.get('/registrations/pending')
    assert.equal(status, 200)
    const line = body.find((row) => row.orderItemId === setup.line.id)
    assert.ok(line, 'furnace line is listed')
    assert.equal(line.quantity, 2)
    assert.equal(line.registered, 0)
    assert.ok(!body.some((row) => row.orderItemId === setup.thermostatLine.id), 'thermostat is not serialised equipment')
  })

  test('refuses non-equipment (no warranty registration)', async () => {
    const notEquipment = await dealer.post('/registrations', { orderItemId: setup.thermostatLine.id })
    assert.equal(notEquipment.status, 400)
    assert.match(notEquipment.body.message, /not serialised equipment/)
  })

  test('registers a unit: next serial number, install date today, warranty 1 year', async () => {
    const before = await highestSerial()
    // The form shows the next serial as soon as a unit is picked...
    const preview = await dealer.get('/registrations/next-serial')
    assert.equal(preview.status, 200)
    assert.equal(preview.body.serialNumber, `SN${before + 1}`)
    // ...and saving assigns exactly that number.
    const { status, body } = await dealer.post('/registrations', { orderItemId: setup.line.id })
    assert.equal(status, 201)
    assert.equal(body.serialNumber, preview.body.serialNumber)
    // The install date is set by the system: always today, whatever the client sends.
    assert.equal(body.installDate.slice(0, 10), today())
    const install = new Date(body.installDate)
    const until = new Date(body.warrantyUntil)
    assert.equal(until.getUTCFullYear() - install.getUTCFullYear(), 1)
    assert.equal(until.getUTCMonth(), install.getUTCMonth())
    assert.equal(until.getUTCDate(), install.getUTCDate())
  })

  test('each unit gets its own serial number, and no more units than were ordered', async () => {
    const second = await dealer.post('/registrations', { orderItemId: setup.line.id })
    assert.equal(second.status, 201)
    const serials = (await prisma.warrantyRegistration.findMany({ where: { orderItemId: setup.line.id }, select: { serialNumber: true } })).map((r) => r.serialNumber)
    assert.equal(new Set(serials).size, 2)

    const third = await dealer.post('/registrations', { orderItemId: setup.line.id })
    assert.equal(third.status, 400)
    assert.match(third.body.message, /already registered/)
    const { body } = await dealer.get('/registrations/pending')
    assert.ok(!body.some((row) => row.orderItemId === setup.line.id), 'fully registered line is no longer listed')
  })
})

describe('Submit Claim', () => {
  let dealer
  let unit
  before(async () => {
    dealer = await signIn('principal@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    const setup = await fulfilledOrder(dealer, desk)
    const { body } = await dealer.post('/registrations', { orderItemId: setup.line.id })
    unit = { ...body, price: setup.furnace.unitPrice }
  })

  test('the unit list shows the warranty end date and the expired flag', async () => {
    const { status, body } = await dealer.get(`/registrations?search=${unit.serialNumber}`)
    assert.equal(status, 200)
    assert.equal(body.length, 1)
    assert.equal(body[0].expired, false)
    assert.equal(body[0].openClaimId, null)
    assert.ok(body[0].warrantyUntil)
  })

  test('the serial number list can be limited to one product', async () => {
    const { status, body } = await dealer.get(`/registrations?productId=${unit.product.id}&limit=200`)
    assert.equal(status, 200)
    assert.ok(body.length > 0)
    assert.ok(body.every((u) => u.product.id === unit.product.id))
    assert.ok(body.some((u) => u.serialNumber === unit.serialNumber))
  })

  test('refuses an amount above the product price', async () => {
    const { status, body } = await dealer.post('/claims', { registrationId: unit.id, amount: unit.price + 1, description: 'Blower motor failed' })
    assert.equal(status, 400)
    assert.match(body.message, /more than the price/)
  })

  test('submits a claim within the warranty, then refuses a second open claim', async () => {
    const first = await dealer.post('/claims', { registrationId: unit.id, amount: 250, description: 'Blower motor failed' })
    assert.equal(first.status, 201)
    assert.equal(first.body.stage, 'submitted')
    assert.equal(first.body.serialNumber, unit.serialNumber)

    const { body: list } = await dealer.get(`/registrations?search=${unit.serialNumber}`)
    assert.equal(list[0].openClaimId, first.body.id)

    const second = await dealer.post('/claims', { registrationId: unit.id, amount: 100, description: 'Again' })
    assert.equal(second.status, 400)
    assert.match(second.body.message, /already has an open claim/)
  })

  test('refuses a claim when the warranty has expired (backend validation)', async () => {
    const yearAgo = new Date()
    yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1)
    const old = await prisma.warrantyRegistration.findFirst({
      where: { dealerId: dealer.user.dealerId, installDate: { lt: yearAgo }, claims: { none: { stage: { in: ['submitted', 'underReview', 'approved'] } } } },
    })
    assert.ok(old, 'demo data has an old unit')
    const { status, body } = await dealer.post('/claims', { registrationId: old.id, amount: 100, description: 'Compressor noise' })
    assert.equal(status, 400)
    assert.match(body.message, /warranty for .* expired on .*1-year warranty/)

    const { body: list } = await dealer.get(`/registrations?search=${old.serialNumber}`)
    assert.equal(list[0].expired, true)
  })
})

// Opens the live-update stream (GET /api/live) and collects its events.
async function openLive(cookie) {
  const controller = new AbortController()
  const res = await fetch(`${base}/live`, { headers: cookie ? { cookie } : {}, signal: controller.signal })
  const events = []
  if (res.ok) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let end
          while ((end = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, end)
            buffer = buffer.slice(end + 2)
            const name = block.match(/^event: (.+)$/m)?.[1]
            const data = block.match(/^data: (.+)$/m)?.[1]
            if (name) events.push({ name, data: data ? JSON.parse(data) : null })
          }
        }
      } catch {
        // aborted at the end of the test
      }
    })()
  }
  return { status: res.status, events, close: () => controller.abort() }
}
const waitFor = async (check, ms = 2000) => {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (check()) return true
    await new Promise((r) => setTimeout(r, 25))
  }
  return false
}

describe('Live updates (Server-Sent Events)', () => {
  test('needs a signed-in user', async () => {
    const live = await openLive(null)
    assert.equal(live.status, 401)
  })

  test('the dealer and its manufacturer get registration and claim events', async () => {
    const dealer = await signIn('principal@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    const dealerLive = await openLive(dealer.cookie)
    const deskLive = await openLive(desk.cookie)
    try {
      assert.equal(dealerLive.status, 200)
      assert.ok(await waitFor(() => dealerLive.events.some((e) => e.name === 'ready')))
      assert.ok(await waitFor(() => deskLive.events.some((e) => e.name === 'ready')))

      const setup = await fulfilledOrder(dealer, desk)
      const { body: unit } = await dealer.post('/registrations', { orderItemId: setup.line.id })
      const { body: claim } = await dealer.post('/claims', { registrationId: unit.id, amount: 120, description: 'Fan motor noisy' })

      for (const live of [dealerLive, deskLive]) {
        assert.ok(await waitFor(() => live.events.some((e) => e.data?.action === 'registration.created' && e.data.id === unit.serialNumber)), 'registration event')
        assert.ok(await waitFor(() => live.events.some((e) => e.data?.action === 'claim.submitted' && e.data.id === claim.id)), 'claim event')
      }
      const event = deskLive.events.find((e) => e.data?.action === 'claim.submitted')
      assert.equal(event.data.dealerId, dealer.user.dealerId)
      assert.equal(event.data.by, dealer.user.id)
      assert.ok(event.data.dealerName)
    } finally {
      dealerLive.close()
      deskLive.close()
    }
  })

  test('an investigation reaches the manufacturer only, never the dealer being investigated', async () => {
    const dealer = await signIn('principal@demo.com')
    const desk = await signIn('manufacturer@demo.com')
    const dealerLive = await openLive(dealer.cookie)
    const deskLive = await openLive(desk.cookie)
    const url = `/manufacturer/claim-insights/dealers/${dealer.user.dealerId}/investigation`
    try {
      assert.ok(await waitFor(() => dealerLive.events.some((e) => e.name === 'ready')))
      assert.ok(await waitFor(() => deskLive.events.some((e) => e.name === 'ready')))

      assert.equal((await desk.post(url, { open: true, note: 'Test' })).status, 200)
      assert.equal((await desk.post(url, { open: false })).status, 200)

      for (const action of ['investigation.opened', 'investigation.closed']) {
        assert.ok(await waitFor(() => deskLive.events.some((e) => e.data?.action === action)), `manufacturer gets ${action}`)
      }
      // Both events have reached the manufacturer; give the dealer's stream the same time.
      await new Promise((r) => setTimeout(r, 200))
      assert.ok(!dealerLive.events.some((e) => e.data?.action?.startsWith('investigation.')), 'dealer gets no investigation event')
    } finally {
      dealerLive.close()
      deskLive.close()
    }
  })
})
