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
const { askCopilot, copilotRecords, rerunCopilot } = await import('../src/services/copilotService.js')

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
// Sales = the dealer's sales to its customers (Place Orders): revenue at the
// selling price, profit = selling price - base price.
const salesIn = (dealerId, createdAt, where = {}) =>
  prisma.dealerSale.findMany({ where: { dealerId, createdAt, ...where }, select: { quantity: true, basePrice: true, sellingPrice: true } })

const revenue = async (dealerId, createdAt) => (await salesIn(dealerId, createdAt)).reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0)

const profit = async (dealerId, createdAt) =>
  (await salesIn(dealerId, createdAt)).reduce((sum, s) => sum + s.quantity * (s.sellingPrice - s.basePrice), 0)

const unitsOf = async (dealerId, category, createdAt) =>
  (await salesIn(dealerId, createdAt, { product: { category } })).reduce((sum, s) => sum + s.quantity, 0)

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

  test('revenue by customer: says it is not recorded by customer (never "No customer")', async () => {
    const answer = await ask('d-1001', 'which customer bought the most last year')
    assert.match(answer.text, /isn't recorded by customer/, answer.text)
    assert.doesNotMatch(answer.text, /No customer/)
  })

  test('top product by sales last year', async () => {
    for (const { id } of dealers) {
      const sales = await prisma.dealerSale.findMany({
        where: { dealerId: id, createdAt: Y2025 },
        select: { quantity: true, sellingPrice: true, product: { select: { sku: true } } },
      })
      if (!sales.length) continue // a dealer with no 2025 sales
      const bySku = new Map()
      for (const s of sales) bySku.set(s.product.sku, (bySku.get(s.product.sku) ?? 0) + s.quantity * s.sellingPrice)
      const [sku, total] = [...bySku.entries()].sort((a, b) => b[1] - a[1])[0]
      const answer = await ask(id, 'which product had the highest sales last year')
      assert.ok(answer.text.includes(sku), `${id}: expected ${sku}, got: ${answer.text}`)
      assert.ok(answer.text.includes(money(total)), `${id}: ${answer.text}`)
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
    ['What were my total sales last year?', 'Revenue · 2025'],
    ['how much did i sell in 2025', 'Revenue · 2025'],
    ['revenue last yr', 'Revenue · 2025'],
    ['sles last year', 'Revenue · 2025'],
    ['total turnover for the previous year', 'Revenue · 2025'],
    ['how much money came in this year', 'Revenue · 2026 so far'],
    ['profit by category last year', 'Profit · by category · 2025'],
    ['top 3 products by profit in 2025', 'Profit · by product · 2025'],
    ['how many claims are pending', 'Claims · Pending · all time'],
    ['How many claims have been settled in 2025?', 'Claims · Settled · 2025'],
    ['warranty claims by status', 'Claims · by status · 2026 so far'],
    ['What is my total pending order quantity?', 'Units on order · Pending · all time'],
    ['how many quotes are open', 'Quotes · Pending · all time'],
    ['commercial sales vs last year', 'Revenue · Commercial · 2026 so far · vs the same period in 2025'],
    ['sales in march 2025', 'Revenue · March 2025'],
    ['sales for the last 6 months', 'Revenue · last 6 months'],
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
    assert.equal(first.understood, 'Revenue · Furnaces · 2025')
    const second = await ask('d-1001', 'and the year before?', ALL_MODULES, first.context)
    assert.equal(second.understood, 'Revenue · Furnaces · 2024')
    const third = await ask('d-1001', 'what about heat pumps', ALL_MODULES, second.context)
    assert.equal(third.understood, 'Revenue · Heat pumps · 2024')
    const fourth = await ask('d-1001', 'by month', ALL_MODULES, third.context)
    assert.equal(fourth.understood, 'Revenue · Heat pumps · by month · 2024')
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

describe('Common misspellings', () => {
  test('misspelled "revenue" is read as revenue, not "review"', async () => {
    for (const question of ['what is reviewne?', 'revinue last year', 'what is my revenu']) {
      const answer = await ask('d-1001', question)
      assert.ok(answer.understood.startsWith('Revenue'), `${question}: ${answer.understood}`)
    }
  })
})

describe('Territory coverage', () => {
  test('answers the dealer coverage, the same as the Dealer 360 tile', async () => {
    const dealer = await prisma.dealer.findUnique({ where: { id: 'd-1001' } })
    const pct = Math.round(dealer.territoryCoverage * 100)
    for (const question of ['What is my territory coverage?', 'coverage']) {
      const answer = await ask('d-1001', question)
      assert.equal(answer.understood, 'Territory coverage', question)
      assert.ok(answer.text.startsWith(`Your territory coverage is ${pct}%`), answer.text)
    }
    assert.equal((await ask('d-1001', 'data coverage')).understood, 'Data coverage')
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

describe('Answer card: big number, summary, two-year chart, filter chips, records', () => {
  const dealer = { id: null, dealerId: 'd-1001', permissions: ALL_MODULES }
  // The context as the browser sends it back (JSON, dates as text).
  const contextOf = (answer) => JSON.parse(JSON.stringify(answer.context))

  test('a monthly answer: chart with last year, best month, partial month, and a summary that does not repeat the big number', async () => {
    const answer = await askCopilot(dealer, 'show revenue by month this year', null, NOW)
    const { chart, highlight, summary } = answer
    assert.equal(chart.points.length, 11, 'Jan to Nov 2026')
    assert.deepEqual(chart.points.slice(0, 3).map((p) => p.label), ['Jan', 'Feb', 'Mar'])
    assert.equal(chart.currentLabel, '2026')
    assert.equal(chart.previousLabel, '2025')
    // Each month next to the same month of 2025.
    for (const p of chart.points) {
      const from = new Date(Date.UTC(p.year - 1, Number(p.key.slice(5, 7)) - 1, 1))
      // The month still running is compared over the same days last year.
      const to = p.partial ? SAME_DAYS_2025.lt : new Date(Date.UTC(p.year - 1, Number(p.key.slice(5, 7)), 1))
      assert.ok(Math.abs(p.previous - (await revenue('d-1001', { gte: from, lt: to }))) < 0.01, p.key)
    }
    // November is still running on 15 Nov: partial, never the best month.
    assert.deepEqual(chart.points.filter((p) => p.partial).map((p) => p.key), ['2026-11'])
    const best = chart.points.filter((p) => !p.partial).reduce((a, b) => (b.value > a.value ? b : a))
    assert.equal(chart.best, best.key)
    assert.match(summary, new RegExp(`Best month: ${best.label} 2026`))
    assert.ok(!summary.includes(highlight.value), 'the summary does not repeat the big number')
    assert.ok(highlight.change && !summary.includes(highlight.change.percent), 'nor the % change')
  })

  test('filter chips: metric, breakdown and period, with the current choice selected', async () => {
    const answer = await askCopilot(dealer, 'show revenue by month this year', null, NOW)
    const byKey = Object.fromEntries(answer.controls.map((c) => [c.key, c]))
    assert.equal(byKey.metric.value, 'revenue')
    assert.deepEqual(byKey.metric.options.map((o) => o.value), ['revenue', 'profit', 'units'])
    assert.equal(byKey.groupBy.value, 'month')
    assert.ok(!byKey.groupBy.options.some((o) => o.value === 'customer'), 'revenue is not recorded by customer')
    assert.equal(byKey.period.value, 'ytd')
  })

  test('changing a chip re-runs the answer with only that change', async () => {
    const answer = await askCopilot(dealer, 'show revenue by month this year', null, NOW)
    const lastYear = await rerunCopilot(dealer, contextOf(answer), { period: 'lastYear' }, NOW)
    assert.ok(lastYear.text.includes(money(await revenue('d-1001', Y2025))), lastYear.text)
    assert.equal(lastYear.chart.points.length, 12)
    const profit = await rerunCopilot(dealer, contextOf(answer), { metric: 'profit' }, NOW)
    assert.equal(profit.controls.find((c) => c.key === 'metric').value, 'profit')
    assert.ok(profit.chart, 'still by month')
    const total = await rerunCopilot(dealer, contextOf(answer), { groupBy: '' }, NOW)
    assert.equal(total.chart, null)
    assert.ok(total.text.includes(money(await revenue('d-1001', YTD))), total.text)
    // Unknown or mismatched choices are refused.
    assert.equal(await rerunCopilot(dealer, contextOf(answer), { metric: 'claimCount' }, NOW), null)
    assert.equal(await rerunCopilot(dealer, contextOf(answer), { period: 'nextYear' }, NOW), null)
    assert.equal(await rerunCopilot(dealer, null, { period: 'ytd' }, NOW), null)
  })

  test('the records behind an answer match its record count, newest first', async () => {
    const answer = await askCopilot(dealer, 'What was my total revenue last year?', null, NOW)
    const records = await copilotRecords(dealer, contextOf(answer))
    assert.equal(records.total, answer.records.count)
    assert.deepEqual(records.columns, ['Date', 'Product', 'Units', 'Revenue', 'Profit'])
    assert.ok(records.rows.every((r) => r[0].startsWith('2025')))
    assert.ok(records.rows[0][0] >= records.rows.at(-1)[0])
  })

  test('chips and records follow role access: a technician gets no sales figures', async () => {
    const answer = await askCopilot(dealer, 'show revenue by month this year', null, NOW)
    const tech = { id: null, dealerId: 'd-1001', permissions: ['home', 'warranty', 'incentives'] }
    const rerun = await rerunCopilot(tech, contextOf(answer), { period: 'lastYear' }, NOW)
    assert.match(rerun.text, /doesn't have access/)
    assert.equal(await copilotRecords(tech, contextOf(answer)), null)
  })
})
