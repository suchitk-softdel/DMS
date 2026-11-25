import { prisma } from '../db/prisma.js'
import { sellingPrices } from './salesService.js'

// Demand Forecast model (in-house): expected units per product for the next
// 30 days = units sold in the same month last year x the dealer's unit growth
// over the last 12 months (capped to 0.5x..1.5x). Compared with stock on hand
// + on order, it gives the shortfall used for stock-out alerts (SRS 3.5).
//
// Reads the Sale aggregate, so new sales to customers feed into it as soon as
// aggregationService has run.

const yearBefore = (date) => {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() - 1)
  return result
}
const monthKey = (date) => date.toISOString().slice(0, 7)
const round3 = (value) => Math.round(value * 1000) / 1000

// -> { growth, items: [{ product, onHand, onOrder, expected, shortfall, revenueAtRisk }] }
//    items sorted by revenue at risk, highest first.
export async function forecastDemand(dealerId, now = new Date()) {
  const lastYear = yearBefore(now)
  const twoYearsAgo = yearBefore(lastYear)
  const [inventory, lastYearSales, recentUnits, olderUnits] = await Promise.all([
    prisma.inventory.findMany({
      where: { dealerId },
      select: { onHand: true, onOrder: true, product: { select: { id: true, sku: true, unitPrice: true } } },
    }),
    prisma.sale.findMany({ where: { dealerId, month: monthKey(lastYear) }, select: { productId: true, units: true } }),
    prisma.sale.aggregate({
      where: { dealerId, month: { gte: monthKey(lastYear), lt: monthKey(now) } },
      _sum: { units: true },
    }),
    prisma.sale.aggregate({
      where: { dealerId, month: { gte: monthKey(twoYearsAgo), lt: monthKey(lastYear) } },
      _sum: { units: true },
    }),
  ])

  const growth = olderUnits._sum.units
    ? Math.min(1.5, Math.max(0.5, recentUnits._sum.units / olderUnits._sum.units))
    : 1
  // Revenue at risk is valued at the dealer's real selling price.
  const sellPrice = await sellingPrices(dealerId, inventory.map((row) => row.product), now)
  const unitsLastYear = new Map(lastYearSales.map((row) => [row.productId, row.units]))

  const items = inventory
    .map((row) => {
      const expected = Math.round((unitsLastYear.get(row.product.id) ?? 0) * growth)
      const shortfall = expected - row.onHand - row.onOrder
      return { ...row, expected, shortfall, revenueAtRisk: Math.round(shortfall * sellPrice.get(row.product.id) * 100) / 100 }
    })
    .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk)

  return { growth: round3(growth), items }
}
