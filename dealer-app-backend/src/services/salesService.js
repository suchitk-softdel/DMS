import { prisma } from '../db/prisma.js'

const monthRange = (from, to) =>
  from || to ? { month: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}

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
