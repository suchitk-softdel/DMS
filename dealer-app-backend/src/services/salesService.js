import { prisma } from '../db/prisma.js'

const monthRange = (from, to) =>
  from || to ? { month: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}

// Revenue = what customers paid the dealer: quantity x selling price of the
// sales on Place Orders (DealerSale) from `from` up to (not including) `to`.
export async function salesRevenue(dealerId, from, to) {
  const rows = await prisma.dealerSale.findMany({
    where: { dealerId, createdAt: { gte: from, lt: to } },
    select: { quantity: true, sellingPrice: true },
  })
  return Math.round(rows.reduce((sum, r) => sum + r.quantity * r.sellingPrice, 0) * 100) / 100
}

// The price the dealer actually sells each product at: revenue / units of its
// sales to customers over the last 12 months (this month included). A product
// not sold in that time gets its base price x the dealer's overall markup over
// the same months, or just its base price when the dealer has no sales at all.
// products: [{ id, unitPrice }]  ->  Map(productId -> selling price)
export async function sellingPrices(dealerId, products, now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 7)
  const rows = await prisma.sale.groupBy({
    by: ['productId'],
    where: { dealerId, month: { gte: from } },
    _sum: { units: true, revenue: true, cost: true },
  })
  const sold = new Map(rows.filter((r) => r._sum.units > 0).map((r) => [r.productId, r._sum]))
  const revenue = rows.reduce((sum, r) => sum + (r._sum.revenue ?? 0), 0)
  const cost = rows.reduce((sum, r) => sum + (r._sum.cost ?? 0), 0)
  const markup = cost > 0 ? revenue / cost : 1
  const round2 = (value) => Math.round(value * 100) / 100
  return new Map(
    products.map((p) => {
      const s = sold.get(p.id)
      return [p.id, round2(s ? s.revenue / s.units : p.unitPrice * markup)]
    }),
  )
}

// Monthly sales per product (for forecasting and product breakdowns).
export function listSales(dealerId, { from, to }) {
  return prisma.sale.findMany({
    where: { dealerId, ...monthRange(from, to) },
    orderBy: [{ month: 'asc' }, { productId: 'asc' }],
    select: { month: true, productId: true, units: true, revenue: true, cost: true },
  })
}

// Monthly totals across all products (for the revenue trend, FR-D360-2).
export async function monthlySalesTotals(dealerId, { from, to }) {
  const rows = await prisma.sale.groupBy({
    by: ['month'],
    where: { dealerId, ...monthRange(from, to) },
    _sum: { units: true, revenue: true, cost: true },
    orderBy: { month: 'asc' },
  })
  const round2 = (value) => Math.round((value ?? 0) * 100) / 100
  return rows.map((row) => ({
    month: row.month,
    units: row._sum.units ?? 0,
    revenue: round2(row._sum.revenue),
    cost: round2(row._sum.cost),
  }))
}
