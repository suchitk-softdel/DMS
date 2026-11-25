// Verifies the loaded dataset and the two models against known results.
//
//   npm run db:verify               check links, aggregates and model outputs
//   npm run db:verify -- --update   save the current model outputs as expected
//
// 1. Links: every claim -> registration -> order line -> fulfilled order, with
//    matching dealer, product, customer and serial number.
// 2. Aggregates: Sale (from customer sales) and IncentiveProgress match what the source records add
//    up to (i.e. the aggregation logic is correct and up to date).
// 3. Models: Dealer Health Score and Demand Forecast for every dealer, as of
//    the dataset end date, must equal prisma/dataset/expected-outputs.json.
//    Because the dataset never changes, any difference means the logic
//    changed: check it was intended, then re-run with --update.
//
// Steps 1 and 2 hold at any time, including after entries made in the app.
// Step 3 uses data up to the dataset end date only, so entries made in the
// app after that date don't change it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { EQUIPMENT_CATEGORIES } from '../src/constants/domain.js'
import { prisma } from '../src/db/prisma.js'
import { forecastDemand } from '../src/services/forecastService.js'
import { computeHealthScore } from '../src/services/healthScoreService.js'

const { values: args } = parseArgs({ options: { update: { type: 'boolean', default: false } } })
// The demo data in prisma/demo.db runs up to this date; the models are checked as of it.
const DATASET_END_DATE = '2026-11-15'
const EXPECTED_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma/dataset/expected-outputs.json')

const failures = []
const check = (ok, message) => {
  if (!ok) failures.push(message)
}
const near = (a, b) => Math.abs(a - b) < 0.05

// ---------------------------------------------------------------------------
// 1. Links between records
// ---------------------------------------------------------------------------
async function checkLinks() {
  const claims = await prisma.claim.findMany({
    include: { registration: { include: { orderItem: true, order: true } } },
  })
  for (const c of claims) {
    const r = c.registration
    check(r.orderId === c.orderId, `${c.id}: order ${c.orderId} differs from its registration's order ${r.orderId}`)
    check(
      r.dealerId === c.dealerId && r.productId === c.productId && r.customerId === c.customerId,
      `${c.id}: dealer/product/customer differ from registration ${r.id}`,
    )
    check(r.serialNumber === c.serialNumber, `${c.id}: serial ${c.serialNumber} differs from ${r.serialNumber}`)
    check(c.filedAt >= r.installDate, `${c.id}: filed before the unit was installed`)
  }

  const registrations = await prisma.warrantyRegistration.findMany({
    include: { orderItem: true, order: true, product: { select: { category: true } } },
  })
  for (const r of registrations) {
    check(r.orderItem.orderId === r.orderId, `${r.id}: order line ${r.orderItemId} is not on order ${r.orderId}`)
    check(r.orderItem.productId === r.productId, `${r.id}: product differs from its order line`)
    check(
      r.order.type === 'order' && r.order.status === 'fulfilled',
      `${r.id}: order ${r.orderId} is ${r.order.type}/${r.order.status}, not a fulfilled order`,
    )
    check(r.order.dealerId === r.dealerId && r.order.customerId === r.customerId, `${r.id}: dealer/customer differ from its order`)
    check(EQUIPMENT_CATEGORIES.includes(r.product.category), `${r.id}: ${r.product.category} is not serialised equipment`)
  }

  // Units registered per order line can't exceed the quantity sold.
  const perLine = await prisma.warrantyRegistration.groupBy({ by: ['orderItemId'], _count: { _all: true } })
  const lines = new Map(
    (await prisma.orderItem.findMany({ select: { id: true, quantity: true } })).map((l) => [l.id, l.quantity]),
  )
  for (const row of perLine) {
    check(row._count._all <= lines.get(row.orderItemId), `Order line ${row.orderItemId}: more registrations than units sold`)
  }

  // Order total = sum of its lines.
  const orders = await prisma.order.findMany({ include: { items: true } })
  for (const o of orders) {
    const sum = o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    check(near(sum, o.total), `${o.id}: total ${o.total} but lines add up to ${sum.toFixed(2)}`)
  }

  return { claims: claims.length, registrations: registrations.length, orders: orders.length }
}

// ---------------------------------------------------------------------------
// 2. Aggregates match the source records
// ---------------------------------------------------------------------------
async function checkAggregates(dealers) {
  for (const { id } of dealers) {
    // Revenue comes from the dealer's sales to customers (Place Orders).
    const [customerSales, summary] = await Promise.all([
      prisma.dealerSale.findMany({ where: { dealerId: id }, select: { quantity: true, sellingPrice: true } }),
      prisma.sale.aggregate({ where: { dealerId: id }, _sum: { revenue: true } }),
    ])
    const fromCustomerSales = customerSales.reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0)
    const fromSummary = summary._sum.revenue ?? 0
    check(
      Math.abs(fromCustomerSales - fromSummary) < 1,
      `${id}: Sale revenue ${fromSummary.toFixed(2)} vs customer sales ${fromCustomerSales.toFixed(2)}`,
    )
  }

  const progress = await prisma.incentiveProgress.findMany({ include: { program: true } })
  for (const p of progress) {
    const reached = JSON.parse(p.program.milestones).filter((m) => p.current >= m.target)
    const expectedEarned = reached.length ? reached[reached.length - 1].payout : 0
    check(p.earned === expectedEarned, `${p.dealerId}/${p.programId}: earned ${p.earned}, milestones say ${expectedEarned}`)
  }
  check(progress.length === dealers.length * (await prisma.incentiveProgram.count()), 'IncentiveProgress is missing rows')
}

// ---------------------------------------------------------------------------
// 3. Model outputs
// ---------------------------------------------------------------------------
async function modelOutputs(dealers, asOf) {
  const outputs = {}
  for (const dealer of dealers) {
    const [health, forecast] = await Promise.all([computeHealthScore(dealer.id, asOf), forecastDemand(dealer.id, asOf)])
    outputs[dealer.id] = {
      dealer: dealer.name,
      healthScore: {
        score: health.score,
        components: Object.fromEntries(health.components.map((c) => [c.key, c.score])),
      },
      forecast: {
        unitGrowth: forecast.growth,
        expectedUnitsNext30Days: forecast.items.reduce((s, i) => s + i.expected, 0),
        atRisk: forecast.items
          .filter((i) => i.shortfall > 0)
          .slice(0, 5)
          .map((i) => ({ sku: i.product.sku, expected: i.expected, onHand: i.onHand, onOrder: i.onOrder, shortfall: i.shortfall })),
      },
    }
  }
  return outputs
}

function diff(expected, actual, where = '') {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return []
  if (typeof expected !== 'object' || typeof actual !== 'object' || expected === null || actual === null) {
    return [`${where}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`]
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
  return [...keys].flatMap((key) => diff(expected[key], actual[key], where ? `${where}.${key}` : key))
}

// ---------------------------------------------------------------------------

async function main() {
  const asOfDate = DATASET_END_DATE
  const asOf = new Date(`${asOfDate}T00:00:00Z`)
  const dealers = await prisma.dealer.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } })


  const linked = await checkLinks()
  console.log(`Links:      ${linked.orders} orders, ${linked.registrations} registrations, ${linked.claims} claims checked`)
  await checkAggregates(dealers)
  console.log(`Aggregates: Sale + IncentiveProgress checked for ${dealers.length} dealers`)

  const outputs = { asOf: asOfDate, dealers: await modelOutputs(dealers, asOf) }
  console.table(
    Object.entries(outputs.dealers).map(([id, o]) => ({
      dealer: id,
      healthScore: o.healthScore.score,
      unitGrowth: o.forecast.unitGrowth,
      next30Days: o.forecast.expectedUnitsNext30Days,
      atRisk: o.forecast.atRisk.map((i) => i.sku).join(', ') || '-',
    })),
  )

  if (args.update) {
    writeFileSync(EXPECTED_FILE, `${JSON.stringify(outputs, null, 2)}\n`)
    console.log('Saved model outputs to prisma/dataset/expected-outputs.json')
  } else if (!existsSync(EXPECTED_FILE)) {
    failures.push('No expected-outputs.json yet: run npm run db:verify -- --update once')
  } else {
    const expected = JSON.parse(readFileSync(EXPECTED_FILE, 'utf8'))
    failures.push(...diff(expected, outputs).map((d) => `Model output changed: ${d}`))
  }

  if (failures.length) {
    console.error(`\n${failures.length} problem(s):`)
    for (const f of failures.slice(0, 40)) console.error(`  - ${f}`)
    process.exitCode = 1
  } else {
    console.log('\nAll checks passed.')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
