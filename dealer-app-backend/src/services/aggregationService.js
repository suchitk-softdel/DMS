import { prisma } from '../db/prisma.js'

// Aggregation logic: turns source records (orders, training) into the summary
// tables the dashboards and models read (Sale, IncentiveProgress).
//
// The same code runs when the dataset is loaded (seed) and after every write
// (new order, status change, completed training), so aggregates always match
// the source records, whether they came from the dataset or were entered
// in the app.

const round2 = (value) => Math.round(value * 100) / 100
const monthKey = (date) => date.toISOString().slice(0, 7)

// Monthly sales per product, from fulfilled orders (month = order date).
async function rebuildSales(tx, dealerId) {
  const items = await tx.orderItem.findMany({
    where: { order: { dealerId, type: 'order', status: 'fulfilled' } },
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      order: { select: { createdAt: true } },
      product: { select: { unitCost: true } },
    },
  })

  const rows = new Map()
  for (const item of items) {
    const month = monthKey(item.order.createdAt)
    const key = `${item.productId}|${month}`
    const row = rows.get(key) ?? { dealerId, productId: item.productId, month, units: 0, revenue: 0, cost: 0 }
    row.units += item.quantity
    row.revenue += item.quantity * item.unitPrice
    row.cost += item.quantity * item.product.unitCost
    rows.set(key, row)
  }
  const data = [...rows.values()].map((row) => ({ ...row, revenue: round2(row.revenue), cost: round2(row.cost) }))

  await tx.sale.deleteMany({ where: { dealerId } })
  if (data.length) await tx.sale.createMany({ data })
  return data
}

// Progress against each incentive program, from sales and completed training.
async function rebuildIncentiveProgress(tx, dealerId, sales) {
  const [programs, products, training] = await Promise.all([
    tx.incentiveProgram.findMany(),
    tx.product.findMany({ select: { id: true, category: true } }),
    tx.trainingProgress.findMany({
      where: { user: { dealerId }, completedAt: { not: null } },
      select: { completedAt: true, course: { select: { durationHours: true } } },
    }),
  ])
  const categoryOf = new Map(products.map((p) => [p.id, p.category]))

  const rows = programs.map((program) => {
    const from = monthKey(program.startDate)
    const to = monthKey(program.endDate)
    let current = 0

    if (program.metric === 'trainingHours') {
      for (const row of training) {
        if (row.completedAt >= program.startDate && row.completedAt <= program.endDate) {
          current += row.course.durationHours
        }
      }
    } else {
      for (const row of sales) {
        if (row.month < from || row.month > to) continue
        if (program.metric === 'revenue') current += row.revenue
        else if (categoryOf.get(row.productId) === program.productCategory) current += row.units
      }
    }

    const reached = JSON.parse(program.milestones).filter((m) => current >= m.target)
    return {
      dealerId,
      programId: program.id,
      current: round2(current),
      earned: reached.length ? reached[reached.length - 1].payout : 0,
    }
  })

  await tx.incentiveProgress.deleteMany({ where: { dealerId } })
  if (rows.length) await tx.incentiveProgress.createMany({ data: rows })
}

// Rebuilds every aggregate for one dealer. Takes well under a second for a
// dealer with two years of data, so it is simply run after each write.
export async function refreshDealerAggregates(dealerId) {
  await prisma.$transaction(async (tx) => {
    const sales = await rebuildSales(tx, dealerId)
    await rebuildIncentiveProgress(tx, dealerId, sales)
  })
}

export async function refreshAllAggregates() {
  const dealers = await prisma.dealer.findMany({ select: { id: true } })
  for (const { id } of dealers) await refreshDealerAggregates(id)
}
