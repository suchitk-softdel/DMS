// Copilot accuracy tests on the fixed 2-year dataset (SRS 3.2, requirement:
// "test all entries for data accuracy, aggregation and output correctness").
//
//   npm test
//
// For every dealer, the expected answer is calculated INDEPENDENTLY of the
// Copilot (directly from orders, order lines and claims with plain Prisma
// queries), then the Copilot is asked in natural language and its answer
// must contain exactly that number. Runs on a temporary copy of
// prisma/demo.db, so the working database is never touched.

import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(path.join(tmpdir(), 'dealer-copilot-test-'))
copyFileSync(path.join(ROOT, 'prisma', 'demo.db'), path.join(tempDir, 'test.db'))
process.env.DATABASE_URL = `file:${path.join(tempDir, 'test.db')}`
process.env.SESSION_SECRET ??= 'test-secret'

const { prisma } = await import('../src/db/prisma.js')
const { askCopilot } = await import('../src/services/copilotService.js')

// The dataset runs up to 15 Nov 2026; questions are asked as of that day.
const NOW = new Date('2026-11-15T12:00:00Z')
const Y2025 = { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2026-01-01T00:00:00Z') }
const YTD = { gte: new Date('2026-01-01T00:00:00Z'), lt: new Date('2026-11-16T00:00:00Z') }
const SAME_DAYS_2025 = { gte: new Date('2025-01-01T00:00:00Z'), lt: new Date('2025-11-16T00:00:00Z') }
const Q4_2025 = { gte: new Date('2025-10-01T00:00:00Z'), lt: new Date('2026-01-01T00:00:00Z') }
const ALL_MODULES = ['home', 'dealer360', 'orders', 'inventory', 'incentives', 'warranty', 'salesCoach']

const money = (v) => `$${Math.round(Math.round(v * 100) / 100).toLocaleString('en-US')}`
const count = (v) => Math.round(v).toLocaleString('en-US')
const ask = (dealerId, question, permissions = ALL_MODULES, context = null) =>
  askCopilot({ id: null, dealerId, permissions }, question, context, NOW)

// Independent calculations ----------------------------------------------------
const revenue = async (dealerId, createdAt) =>
  (await prisma.order.aggregate({ where: { dealerId, type: 'order', status: 'fulfilled', createdAt }, _sum: { total: true } }))._sum.total ?? 0

const profit = async (dealerId, createdAt) => {
  const lines = await prisma.orderItem.findMany({
    where: { order: { dealerId, type: 'order', status: 'fulfilled', createdAt } },
    select: { quantity: true, unitPrice: true, product: { select: { unitCost: true } } },
  })
  return lines.reduce((sum, l) => sum + l.quantity * (l.unitPrice - l.product.unitCost), 0)
}

const unitsOf = async (dealerId, category, createdAt) =>
  (await prisma.orderItem.aggregate({
    where: { product: { category }, order: { dealerId, type: 'order', status: 'fulfilled', createdAt } },
    _sum: { quantity: true },
  }))._sum.quantity ?? 0

const orderCount = (dealerId, createdAt) =>
  prisma.order.count({ where: { dealerId, type: 'order', status: { not: 'draft' }, createdAt } })

const claimCount = (dealerId, where) => prisma.claim.count({ where: { dealerId, ...where } })

const pctChange = (current, previous) => `${Math.abs((current / previous - 1) * 100).toFixed(1)}%`

// -----------------------------------------------------------------------------

let dealers = []
before(async () => {
  dealers = await prisma.dealer.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } })
})
after(async () => {
  await prisma.$disconnect()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Copilot answers match independently calculated values, for every dealer', () => {
  test('total sales last year', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'What were my total sales last year?')
      assert.match(answer.text, new RegExp(money(await revenue(id, Y2025)).replace('$', '\\$')), `${id}: ${answer.text}`)
    }
  })

  test('sales this year compared with last year', async () => {
    for (const { id } of dealers) {
      const [current, previous] = [await revenue(id, YTD), await revenue(id, SAME_DAYS_2025)]
      const answer = await ask(id, 'compare my sales with last year')
      assert.ok(answer.text.includes(money(current)), `${id}: ${answer.text}`)
      assert.ok(answer.text.includes(money(previous)), `${id}: ${answer.text}`)
      assert.ok(answer.text.includes(pctChange(current, previous)), `${id}: ${answer.text}`)
      assert.ok(answer.text.includes(current >= previous ? 'up' : 'down'), `${id}: ${answer.text}`)
    }
  })

  test('profit last year', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'what was my total profit last year')
      assert.ok(answer.text.includes(money(await profit(id, Y2025))), `${id}: ${answer.text}`)
    }
  })

  test('furnace units sold in Q4 2025', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'how many furnaces did we sell in Q4 2025')
      assert.ok(answer.text.includes(`sold ${count(await unitsOf(id, 'furnace', Q4_2025))} furnaces`), `${id}: ${answer.text}`)
    }
  })

  test('orders placed last year', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'How many orders did I place last year?')
      const expected = await orderCount(id, Y2025)
      assert.ok(answer.text.includes(`${count(expected)} order`), `${id}: ${answer.text}`)
    }
  })

  test('pending claims (all time)', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'what is the total number of pending claims')
      const expected = await claimCount(id, { stage: { in: ['submitted', 'underReview'] } })
      assert.ok(answer.text.includes(`${count(expected)} pending claim`), `${id}: ${answer.text}`)
    }
  })

  test('rejected claims last year', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'how many claims were rejected last year')
      const expected = await claimCount(id, { stage: 'rejected', filedAt: Y2025 })
      assert.ok(answer.text.includes(`${count(expected)} rejected claim`), `${id}: ${answer.text}`)
    }
  })

  test('top customer by sales last year', async () => {
    for (const { id } of dealers) {
      const rows = await prisma.order.groupBy({
        by: ['customerId'],
        where: { dealerId: id, type: 'order', status: 'fulfilled', createdAt: Y2025 },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 1,
      })
      if (!rows.length) continue // a dealer with no 2025 sales
      const customer = await prisma.customer.findUnique({ where: { id: rows[0].customerId } })
      const answer = await ask(id, 'which customer bought the most last year')
      assert.ok(answer.text.startsWith(customer.name), `${id}: expected ${customer.name}, got: ${answer.text}`)
      assert.ok(answer.text.includes(money(rows[0]._sum.total)), `${id}: ${answer.text}`)
    }
  })

  test('monthly sales add up to the yearly total', async () => {
    for (const { id } of dealers) {
      const answer = await ask(id, 'sales by month in 2025')
      const total = await revenue(id, Y2025)
      assert.ok(answer.text.includes(money(total)), `${id}: ${answer.text}`)
      if (total > 0) assert.ok(answer.table.rows.length >= 1 && answer.table.rows.length <= 12, `${id}: month rows`)
    }
  })
})

describe('Understanding different wordings', () => {
  const CASES = [
    ['What were my total sales last year?', 'Sales · 2025'],
    ['how much did i sell in 2025', 'Sales · 2025'],
    ['revenue last yr', 'Sales · 2025'],
    ['sles last year', 'Sales · 2025'],
    ['total turnover for the previous year', 'Sales · 2025'],
    ['how much money came in this year', 'Sales · 2026 so far'],
    ['profit by category last year', 'Profit · by category · 2025'],
    ['top 3 products by profit in 2025', 'Profit · by product · 2025'],
    ['how many claims are pending', 'Claims · Pending · all time'],
    ['How many claims have been settled in 2025?', 'Claims · Settled · 2025'],
    ['warranty claims by status', 'Claims · by status · 2026 so far'],
    ['What is my total pending order quantity?', 'Units on order · Pending · all time'],
    ['how many quotes are open', 'Quotes · Pending · all time'],
    ['commercial sales vs last year', 'Sales · Commercial · 2026 so far · vs the same period in 2025'],
    ['sales in march 2025', 'Sales · March 2025'],
    ['sales for the last 6 months', 'Sales · last 6 months'],
    ['what should I stock next month', 'Demand forecast · next 30 days'],
    ['which incentive am i closest to', 'Incentive programs'],
    ['what is my health score', 'Health Score'],
  ]
  for (const [question, understood] of CASES) {
    test(question, async () => {
      const answer = await ask('d-1001', question)
      assert.equal(answer.understood, understood)
    })
  }
})

describe('Follow-up questions', () => {
  test('topic, period and filters carry over', async () => {
    const first = await ask('d-1001', 'furnace sales last year')
    assert.equal(first.understood, 'Sales · Furnaces · 2025')
    const second = await ask('d-1001', 'and the year before?', ALL_MODULES, first.context)
    assert.equal(second.understood, 'Sales · Furnaces · 2024')
    const third = await ask('d-1001', 'what about heat pumps', ALL_MODULES, second.context)
    assert.equal(third.understood, 'Sales · Heat pumps · 2024')
    const fourth = await ask('d-1001', 'by month', ALL_MODULES, third.context)
    assert.equal(fourth.understood, 'Sales · Heat pumps · by month · 2024')
  })
})

describe('Unrelated questions never repeat the previous answer', () => {
  test('users, dealers and customers after a profit question', async () => {
    const profit = await ask('d-1001', 'what was my profit last year')
    const users = await ask('d-1001', 'how much user are there?', ALL_MODULES, profit.context)
    assert.equal(users.understood, 'Users · your dealership')
    assert.equal(users.text, `Summit Comfort Heating & Air has ${await prisma.user.count({ where: { dealerId: 'd-1001' } })} users in the Dealer App.`)

    const dealers = await ask('d-1001', 'how many delaersa re there?', ALL_MODULES, profit.context)
    assert.equal(dealers.understood, 'Dealer network')
    assert.ok(dealers.text.startsWith(`There are ${await prisma.dealer.count()} dealers`), dealers.text)

    const customers = await ask('d-1001', 'how many customers do I have', ALL_MODULES, profit.context)
    assert.ok(customers.text.startsWith(`You have ${await prisma.customer.count({ where: { dealerId: 'd-1001' } })} customers`), customers.text)

    const offTopic = await ask('d-1001', 'what about the weather', ALL_MODULES, profit.context)
    assert.notEqual(offTopic.text, profit.text)
    assert.doesNotMatch(offTopic.text, /\$\d/)
  })
})

describe('No guessing from filler words', () => {
  test('a question with no known topic word is not answered with sales', async () => {
    for (const question of ['how many tables are there in the database?', 'what is in the system?', 'how many are there']) {
      const answer = await ask('d-1001', question)
      assert.doesNotMatch(answer.text, /$d/, `${question}: ${answer.text}`)
    }
  })

  test('roles are answered from the database', async () => {
    const answer = await askCopilot({ id: null, dealerId: 'd-1001', roleId: 'principal', permissions: ALL_MODULES }, 'how many roles are there in database?', null, NOW)
    assert.equal(answer.understood, 'User roles')
    assert.ok(answer.text.startsWith('There are 2 account types'), answer.text)
    assert.match(answer.text, /signed in as a Dealer/)
    const users = await prisma.user.count({ where: { dealerId: 'd-1001' } })
    assert.deepEqual(answer.table.rows[0].slice(0, 2), ['Dealer (you)', users])
  })
})

describe('Data coverage', () => {
  test('years of data match the first and latest order', async () => {
    for (const { id } of dealers) {
      const range = await prisma.order.aggregate({ where: { dealerId: id }, _min: { createdAt: true }, _max: { createdAt: true } })
      const answer = await ask(id, 'how many yaers of data do we have?')
      assert.equal(answer.understood, 'Data coverage')
      const fmt = (d) => `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`
      assert.ok(answer.text.includes(`from ${fmt(range._min.createdAt)} to ${fmt(range._max.createdAt)}`), `${id}: ${answer.text}`)
    }
  })
})

describe('Stock, prices, averages, installs, training and pipeline', () => {
  test('furnaces in stock', async () => {
    for (const { id } of dealers) {
      const rows = await prisma.inventory.findMany({ where: { dealerId: id, product: { category: 'furnace' } } })
      const onHand = rows.reduce((sum, r) => sum + r.onHand, 0)
      const answer = await ask(id, 'how many furnaces are in stock?')
      assert.ok(answer.text.startsWith(`You have ${count(onHand)} furnaces in stock`), `${id}: ${answer.text}`)
    }
  })

  test('list price of a product', async () => {
    const product = await prisma.product.findUnique({ where: { sku: 'FN-H96-80' } })
    const answer = await ask('d-1001', 'what is the price of FN-H96-80')
    assert.ok(answer.text.includes(money(product.unitPrice)), answer.text)
  })

  test('average order value last year', async () => {
    for (const { id } of dealers) {
      const orders = await prisma.order.findMany({ where: { dealerId: id, type: 'order', status: { not: 'draft' }, createdAt: Y2025 }, select: { total: true } })
      if (!orders.length) continue
      const answer = await ask(id, 'what was my average order value last year')
      assert.ok(answer.text.includes(money(orders.reduce((sum, o) => sum + o.total, 0) / orders.length)), `${id}: ${answer.text}`)
    }
  })

  test('units installed last year', async () => {
    for (const { id } of dealers) {
      const installed = await prisma.warrantyRegistration.count({ where: { dealerId: id, installDate: Y2025 } })
      const answer = await ask(id, 'how many units did we install last year')
      assert.ok(answer.text.includes(`registered ${count(installed)} unit`), `${id}: ${answer.text}`)
    }
  })

  test('open sales pipeline', async () => {
    for (const { id } of dealers) {
      const open = await prisma.opportunity.findMany({ where: { dealerId: id, stage: { in: ['new', 'qualified', 'proposal', 'negotiation'] } } })
      const answer = await ask(id, 'show my sales pipeline')
      assert.ok(answer.text.includes(money(open.reduce((sum, o) => sum + o.budget, 0))), `${id}: ${answer.text}`)
    }
  })

  test('training progress for the signed-in user', async () => {
    const done = await prisma.trainingProgress.count({ where: { userId: 'u-002', completionPct: 100, course: { scheduledAt: null } } })
    const answer = await askCopilot({ id: 'u-002', dealerId: 'd-1001', roleId: 'principal', permissions: ALL_MODULES }, 'how is my training going', null, NOW)
    assert.ok(answer.text.startsWith(`You have completed ${done} of`), answer.text)
  })
})

describe('Safety', () => {
  test('a technician cannot see sales figures', async () => {
    const answer = await ask('d-1001', 'what were my sales last year', ['home', 'warranty', 'incentives'])
    assert.match(answer.text, /doesn't have access/)
    assert.doesNotMatch(answer.text, /\$\d/)
  })

  test('a dealer only sees its own data', async () => {
    const summit = await ask('d-1001', 'What were my total sales last year?')
    const coastal = await ask('d-1002', 'What were my total sales last year?')
    assert.ok(summit.text.includes(money(await revenue('d-1001', Y2025))))
    assert.ok(coastal.text.includes(money(await revenue('d-1002', Y2025))))
    assert.notEqual(summit.text, coastal.text)
  })

  test('off-topic questions are declined, never guessed', async () => {
    for (const question of ['what is the weather today', 'write me a poem', 'who won the match']) {
      const answer = await ask('d-1001', question)
      assert.match(answer.text, /only answer questions about your dealership|not .*sure what you mean/, `${question}: ${answer.text}`)
      assert.doesNotMatch(answer.text, /\$\d/)
    }
  })
})
