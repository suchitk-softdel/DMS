// Tests for the endpoints that had no tests yet: session (/me, /logout),
// roles, notifications (bell), product catalogue, sales, Warranty KPI summary,
// incentives, training and Sales Coach opportunities. Each block also checks the role
// rules (which logins may open the module) and that a dealer only sees its own
// data.
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
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-data-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { createApp } = await import('../src/app.js')

let server
let base
after(async () => {
  server.close()
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

const login = (email, password = 'demo123') =>
  fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

// Signs in and returns a small client that sends the session cookie.
async function signIn(email) {
  const res = await login(email)
  assert.equal(res.status, 200, `login ${email}`)
  const cookie = res.headers.get('set-cookie').split(';')[0]
  const call = async (method, url, body) => {
    const r = await fetch(`${base}${url}`, {
      method,
      headers: { cookie, ...(body && { 'Content-Type': 'application/json' }) },
      body: body && JSON.stringify(body),
    })
    return { status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json() }
  }
  return { cookie, user: await res.json(), get: (url) => call('GET', url), post: (url, body) => call('POST', url, body) }
}

const dealerIdOf = async (email) => (await prisma.user.findUnique({ where: { email } })).dealerId

let principal // Summit Comfort, every dealer module
let sales // Summit Comfort, no Dealer 360, no Warranty
let tech // Summit Comfort, Home, Warranty, Incentives
let principal2 // Coastal Climate (another dealer)
let desk // manufacturer order desk
before(async () => {
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api`
  ;[principal, sales, tech, principal2, desk] = await Promise.all(
    ['principal@demo.com', 'sales@demo.com', 'tech@demo.com', 'principal2@demo.com', 'manufacturer@demo.com'].map(signIn),
  )
})

describe('Session: login, /me and logout', () => {
  test('login needs both email and password', async () => {
    assert.equal((await login('principal@demo.com', '')).status, 400)
    assert.equal((await login('', 'demo123')).status, 400)
  })

  test('a wrong password is refused without a session cookie', async () => {
    const res = await login('principal@demo.com', 'wrong-password')
    assert.equal(res.status, 401)
    assert.equal(res.headers.get('set-cookie'), null)
  })

  test('/me returns the signed-in user without the permission list', async () => {
    const { status, body } = await principal.get('/auth/me')
    assert.equal(status, 200)
    assert.equal(body.email, 'principal@demo.com')
    assert.equal(body.id, principal.user.id)
    assert.ok(!('permissions' in body))
    assert.ok(!('passwordHash' in body) && !('password' in body), 'no password data')
  })

  test('/me without a session cookie is 401', async () => {
    assert.equal((await fetch(`${base}/auth/me`)).status, 401)
  })

  test('logout answers 204 and clears the session cookie', async () => {
    const own = await signIn('principal@demo.com') // own session, so the shared one stays signed in
    const res = await own.post('/auth/logout')
    assert.equal(res.status, 204)
    const cleared = res.headers.get('set-cookie')
    assert.ok(cleared, 'sends a Set-Cookie header')
    assert.equal(cleared.split(';')[0].split('=')[0], own.cookie.split('=')[0], 'same cookie name')
    assert.match(cleared, /Expires=Thu, 01 Jan 1970/i)
  })
})

describe('Product catalogue (/products)', () => {
  test('lists every product, sorted by category then SKU, with only catalogue fields', async () => {
    const { status, body } = await principal.get('/products')
    assert.equal(status, 200)
    assert.equal(body.length, await prisma.product.count())
    const keys = ['category', 'id', 'name', 'packSize', 'sku', 'unitPrice']
    for (const p of body) assert.deepEqual(Object.keys(p).sort(), keys)
    const order = body.map((p) => `${p.category}|${p.sku}`)
    assert.deepEqual(order, [...order].sort())
  })

  test('is open to every dealer role (needed by orders, inventory and warranty)', async () => {
    for (const client of [sales, tech]) assert.equal((await client.get('/products')).status, 200)
  })

  test('needs a session', async () => {
    assert.equal((await fetch(`${base}/products`)).status, 401)
  })
})

describe('Sales (/sales, /sales/monthly)', () => {
  test('monthly totals equal the sum of the per-product rows', async () => {
    const [rows, monthly] = await Promise.all([principal.get('/sales'), principal.get('/sales/monthly')])
    assert.equal(rows.status, 200)
    assert.equal(monthly.status, 200)
    assert.ok(monthly.body.length > 0)
    const byMonth = new Map()
    for (const r of rows.body) {
      const m = byMonth.get(r.month) ?? { units: 0, revenue: 0 }
      byMonth.set(r.month, { units: m.units + r.units, revenue: m.revenue + r.revenue })
    }
    assert.equal(monthly.body.length, byMonth.size)
    for (const m of monthly.body) {
      assert.equal(m.units, byMonth.get(m.month).units, m.month)
      assert.ok(Math.abs(m.revenue - byMonth.get(m.month).revenue) < 0.01, m.month)
    }
    const months = monthly.body.map((m) => m.month)
    assert.deepEqual(months, [...months].sort(), 'oldest month first')
  })

  test('from / to limit the months (both ends included)', async () => {
    const { body: all } = await principal.get('/sales/monthly')
    const from = all[1].month
    const to = all[3].month
    const { status, body } = await principal.get(`/sales/monthly?from=${from}&to=${to}`)
    assert.equal(status, 200)
    assert.deepEqual(body.map((m) => m.month), all.slice(1, 4).map((m) => m.month))
    const rows = await principal.get(`/sales?from=${from}&to=${to}`)
    assert.ok(rows.body.every((r) => r.month >= from && r.month <= to))
  })

  test('a month that is not YYYY-MM is a 400', async () => {
    for (const bad of ['2026-13', '2026-1', 'last-year']) {
      assert.equal((await principal.get(`/sales/monthly?from=${bad}`)).status, 400, bad)
    }
    assert.equal((await principal.get('/sales?to=2026/01')).status, 400)
  })

  test("a dealer only gets its own dealership's sales", async () => {
    const [mine, theirs] = await Promise.all([principal.get('/sales/monthly'), principal2.get('/sales/monthly')])
    const dealerId = await dealerIdOf('principal@demo.com')
    const units = await prisma.sale.aggregate({ where: { dealerId }, _sum: { units: true } })
    assert.equal(mine.body.reduce((s, m) => s + m.units, 0), units._sum.units)
    assert.notDeepEqual(mine.body, theirs.body)
  })

  test('needs the Dealer 360 module: sales rep, technician and manufacturer get 403', async () => {
    for (const client of [sales, tech, desk]) {
      assert.equal((await client.get('/sales')).status, 403, client.user.email)
      assert.equal((await client.get('/sales/monthly')).status, 403, client.user.email)
    }
  })
})

describe('Warranty KPI summary (/claims/summary)', () => {
  test('stage counts match the claims in the database', async () => {
    const { status, body } = await principal.get('/claims/summary')
    assert.equal(status, 200)
    const dealerId = await dealerIdOf('principal@demo.com')
    const groups = await prisma.claim.groupBy({ by: ['stage'], where: { dealerId }, _count: { _all: true } })
    for (const g of groups) assert.equal(body.counts[g.stage], g._count._all, g.stage)
    assert.equal(body.openClaims, body.counts.submitted + body.counts.underReview)
  })

  test('the summary agrees with the claims list on the board', async () => {
    const [{ body: summary }, { body: claims }] = await Promise.all([principal.get('/claims/summary'), principal.get('/claims')])
    const open = claims.filter((c) => c.stage === 'submitted' || c.stage === 'underReview')
    assert.equal(summary.openClaims, open.length)
    assert.equal(summary.aging, open.filter((c) => c.ageDays > summary.agingDays).length)
  })

  test('rates and averages are in range and consistent', async () => {
    const { body } = await principal.get('/claims/summary')
    assert.ok(Number.isInteger(body.agingDays) && body.agingDays > 0)
    assert.ok(body.aging <= body.openClaims)
    assert.ok(body.rejected <= body.decided)
    if (body.decided) {
      assert.ok(body.approvalRate >= 0 && body.approvalRate <= 1)
      assert.ok(Math.abs(body.approvalRate - (body.decided - body.rejected) / body.decided) < 0.001)
      assert.ok(body.avgResolutionDays >= 0)
    } else {
      assert.equal(body.approvalRate, null)
      assert.equal(body.avgResolutionDays, null)
    }
  })

  test("each dealer gets its own dealership's numbers", async () => {
    const { body } = await principal2.get('/claims/summary')
    const dealerId = await dealerIdOf('principal2@demo.com')
    const open = await prisma.claim.count({ where: { dealerId, stage: { in: ['submitted', 'underReview'] } } })
    assert.equal(body.openClaims, open)
  })

  test('technician can open it; sales rep and manufacturer cannot', async () => {
    assert.equal((await tech.get('/claims/summary')).status, 200)
    assert.equal((await sales.get('/claims/summary')).status, 403)
    assert.equal((await desk.get('/claims/summary')).status, 403)
  })
})

describe('Incentives (/incentives)', () => {
  test('lists every program with progress, next milestone and peer rank', async () => {
    const { status, body } = await principal.get('/incentives')
    assert.equal(status, 200)
    assert.equal(body.length, await prisma.incentiveProgram.count())
    for (const p of body) {
      assert.ok(Array.isArray(p.milestones) && p.milestones.length > 0, p.name)
      assert.ok(p.percentToNext >= 0 && p.percentToNext <= 100, p.name)
      if (p.nextMilestone) {
        assert.ok(p.current < p.nextMilestone.target, 'next milestone is not reached yet')
        assert.equal(p.percentToNext, Math.min(100, Math.round((p.current / p.nextMilestone.target) * 100)))
      } else {
        assert.equal(p.percentToNext, 100, 'all milestones reached')
      }
      if (p.peerRank !== null) assert.ok(p.peerRank >= 1 && p.peerRank <= p.peerCount)
      assert.ok(!('progress' in p), 'other dealers’ progress is not sent')
    }
  })

  test('progress is per dealership', async () => {
    const dealerId = await dealerIdOf('principal2@demo.com')
    const { body } = await principal2.get('/incentives')
    for (const p of body) {
      const row = await prisma.incentiveProgress.findFirst({ where: { dealerId, programId: p.id } })
      assert.equal(p.current, row?.current ?? 0, p.name)
    }
  })

  test('open to principal, sales rep and technician; not to the manufacturer', async () => {
    for (const client of [sales, tech]) assert.equal((await client.get('/incentives')).status, 200, client.user.email)
    assert.equal((await desk.get('/incentives')).status, 403)
  })
})

describe('Training (/training)', () => {
  test('splits courses, upcoming events and earned certifications', async () => {
    const { status, body } = await principal.get('/training')
    assert.equal(status, 200)
    const now = Date.now()
    assert.ok(body.courses.every((c) => !c.scheduledAt), 'courses are self-paced')
    assert.ok(body.upcomingEvents.every((c) => new Date(c.scheduledAt).getTime() >= now - 60_000), 'events are in the future')
    const dates = body.upcomingEvents.map((c) => c.scheduledAt)
    assert.deepEqual(dates, [...dates].sort(), 'soonest event first')
    for (const c of [...body.courses, ...body.upcomingEvents]) {
      assert.ok(c.completionPct >= 0 && c.completionPct <= 100, c.id)
    }
  })

  test('certifications come only from completed courses that grant one', async () => {
    const { body } = await principal.get('/training')
    const all = [...body.courses, ...body.upcomingEvents]
    for (const cert of body.certifications) {
      const course = all.find((c) => c.id === cert.courseId)
      if (course) {
        assert.equal(course.completionPct, 100)
        assert.equal(course.certification, cert.name)
      } else {
        // A past scheduled course is not listed as a course or event any more.
        const row = await prisma.trainingCourse.findUnique({ where: { id: cert.courseId } })
        assert.equal(row.certification, cert.name)
      }
    }
  })

  test('progress is per user, not per dealership', async () => {
    const [mine, techs] = await Promise.all([principal.get('/training'), tech.get('/training')])
    for (const [client, res] of [[principal, mine], [tech, techs]]) {
      for (const c of res.body.courses) {
        const row = await prisma.trainingProgress.findFirst({ where: { userId: client.user.id, courseId: c.id } })
        assert.equal(c.completionPct, row?.completionPct ?? 0, `${client.user.email} ${c.id}`)
      }
    }
  })

  test('not open to the manufacturer', async () => {
    assert.equal((await desk.get('/training')).status, 403)
  })
})

describe('Sales Coach opportunities (/opportunities)', () => {
  test("lists the dealer's opportunities by decision date, with the customer", async () => {
    const { status, body } = await principal.get('/opportunities')
    assert.equal(status, 200)
    const dealerId = await dealerIdOf('principal@demo.com')
    assert.equal(body.length, await prisma.opportunity.count({ where: { dealerId } }))
    const dates = body.map((o) => new Date(o.decisionDate).getTime())
    assert.deepEqual(dates, [...dates].sort((a, b) => a - b))
    for (const o of body) {
      assert.ok(o.customer?.name, 'customer is included')
      assert.ok(!('dealerId' in o) && !('customerId' in o), 'internal ids are not sent')
    }
  })

  test('?stage= filters, and an unknown stage is a 400', async () => {
    const { body: all } = await principal.get('/opportunities')
    const stage = all[0].stage
    const { status, body } = await principal.get(`/opportunities?stage=${stage}`)
    assert.equal(status, 200)
    assert.ok(body.length > 0 && body.every((o) => o.stage === stage))
    assert.equal(body.length, all.filter((o) => o.stage === stage).length)
    assert.equal((await principal.get('/opportunities?stage=not-a-stage')).status, 400)
  })

  test("a dealer never sees another dealership's opportunities", async () => {
    const [{ body: mine }, { body: theirs }] = await Promise.all([principal.get('/opportunities'), principal2.get('/opportunities')])
    const mineIds = new Set(mine.map((o) => o.id))
    assert.ok(theirs.every((o) => !mineIds.has(o.id)))
  })

  test('open to principal and sales rep; not to technician or manufacturer', async () => {
    assert.equal((await sales.get('/opportunities')).status, 200)
    assert.equal((await tech.get('/opportunities')).status, 403)
    assert.equal((await desk.get('/opportunities')).status, 403)
  })
})

describe('Roles (/roles)', () => {
  test('is public (the app builds the menu from it) and lists each role with its modules', async () => {
    const res = await fetch(`${base}/roles`) // no session cookie
    assert.equal(res.status, 200)
    const roles = await res.json()
    assert.deepEqual(roles.map((r) => r.id), ['manufacturer', 'principal', 'salesRep', 'technician'])
    for (const r of roles) assert.ok(Array.isArray(r.permissions) && r.permissions.length > 0, r.id)
    const byId = Object.fromEntries(roles.map((r) => [r.id, r.permissions]))
    assert.deepEqual(byId.manufacturer, ['orderApprovals'])
    assert.ok(!byId.salesRep.includes('warranty') && !byId.salesRep.includes('dealer360'))
    assert.ok(!byId.technician.includes('orders'))
  })
})

describe('Notifications (/notifications)', () => {
  const KINDS = new Set(['success', 'info', 'warning', 'error'])
  const checkShape = (body) => {
    assert.ok(Number.isInteger(body.count) && body.count >= 0)
    assert.ok(body.items.length <= 8, 'at most 8 items')
    for (const n of body.items) {
      assert.ok(n.id && n.title && n.detail, n.id)
      assert.ok(KINDS.has(n.kind), n.kind)
      assert.ok(n.link.startsWith('/'), n.link)
      assert.ok(!Number.isNaN(new Date(n.at).getTime()), 'valid date')
    }
  }

  test('needs a session', async () => {
    assert.equal((await fetch(`${base}/notifications`)).status, 401)
  })

  test('every role gets a well-formed list', async () => {
    for (const client of [principal, sales, tech, desk]) {
      const { status, body } = await client.get('/notifications')
      assert.equal(status, 200, client.user.email)
      checkShape(body)
    }
  })

  test('aging-claims warning matches the Warranty KPI', async () => {
    const [{ body }, { body: summary }] = await Promise.all([principal.get('/notifications'), principal.get('/claims/summary')])
    const item = body.items.find((n) => n.id === 'aging-claims')
    if (summary.aging) {
      assert.ok(item, 'warning is shown')
      assert.match(item.title, new RegExp(`^${summary.aging} claim`))
      assert.equal(item.link, '/warranty')
    } else {
      assert.equal(item, undefined)
    }
  })

  test('each role only gets notifications for the modules it can open', async () => {
    const ids = async (client) => (await client.get('/notifications')).body.items.map((n) => n.id)
    // Technician: no Orders, no Inventory.
    assert.ok((await ids(tech)).every((id) => !id.startsWith('decided-') && id !== 'stock-out'))
    // Sales rep: no Warranty.
    assert.ok(!(await ids(sales)).includes('aging-claims'))
    // Manufacturer: only order-desk items.
    const desks = (await desk.get('/notifications')).body.items
    assert.ok(desks.every((n) => /^(approve|answered)-/.test(n.id) && n.link.startsWith('/order-details')))
  })

  test('a new order request reaches the manufacturer, and the rejection reaches the dealer', async () => {
    const product = await prisma.product.findFirst({ orderBy: { sku: 'asc' } })
    const before = (await desk.get('/notifications')).body.count
    const created = await principal.post('/orders', {
      type: 'order',
      status: 'submitted',
      items: [{ productId: product.id, quantity: 1 }],
    })
    assert.equal(created.status, 201)
    const id = created.body.id

    const afterSubmit = (await desk.get('/notifications')).body
    assert.equal(afterSubmit.count, before + 1)

    const reason = 'Test: product discontinued'
    assert.equal((await desk.post(`/manufacturer/orders/${id}/reject`, { reason })).status, 200)
    const dealerSide = (await principal.get('/notifications')).body.items.find((n) => n.id === `decided-${id}`)
    assert.ok(dealerSide, 'dealer is told about the rejection')
    assert.equal(dealerSide.kind, 'error')
    assert.equal(dealerSide.detail, `Reason: ${reason}`)
    assert.equal(dealerSide.link, `/orders?order=${id}`)
    assert.equal((await desk.get('/notifications')).body.count, before, 'no longer waiting for approval')
  })
})
