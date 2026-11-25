import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'
import { sellingPrices } from './salesService.js'

// The dealer's product list with current stock (SRS 3.5). Also used by the
// Copilot (stock answers).
export async function listInventory(dealerId) {
  const rows = await prisma.inventory.findMany({
    where: { dealerId },
    orderBy: { product: { sku: 'asc' } },
    include: { product: { select: { id: true, sku: true, name: true, category: true, unitPrice: true, unitCost: true } } },
  })
  return rows.map(({ id: _id, dealerId: _d, productId: _p, ...row }) => row)
}

// ---------------------------------------------------------------------------
// Inventory dashboard (GET /inventory/overview)
// ---------------------------------------------------------------------------

const round2 = (value) => Math.round(value * 100) / 100
const monthKey = (date) => date.toISOString().slice(0, 7)

// Out of stock: none on hand. Low stock: at or below the reorder point.
export const stockStatus = (row) => (row.onHand === 0 ? 'out' : row.onHand <= row.reorderPoint ? 'low' : 'ok')

// The last `count` COMPLETE calendar months before `now`, oldest first.
// e.g. on 22 Nov 2026 -> ['2026-08', '2026-09', '2026-10']. The current month
// is left out because it is not over yet (a part month would look like a drop).
export function lastCompleteMonths(now, count = 3) {
  return Array.from({ length: count }, (_, i) => monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count + i, 1))))
}

// % change from `before` to `after`; null when there is nothing to compare with.
const changePct = (before, after) => (before > 0 ? round2(((after - before) / before) * 100) : null)

// Everything the Inventory screen shows, calculated from the dealer's own data:
//   pricing   - stock value at selling price and at base price (what the dealer
//               paid), incoming value, margin, selling price range
//   products  - each product with stock, status and its last 3 months of sales
//   months    - the 3 complete months used for "recent performance"
//   salesMonths - the last 12 complete months plus the current month (so far),
//               oldest first; each product's `sales` lines up with it (Sales tab
//               period switch: this month / 3 / 6 / 12 months)
//   monthly   - units and revenue per month (all products)
//   orders    - the dealer's orders with the manufacturer, by step, and approval time
//   manufacturer - who supplies the dealer
//   insights  - best seller, fastest growing, slow movers, highest margin
export async function getInventoryOverview(dealerId, now = new Date()) {
  const months = lastCompleteMonths(now, 3)
  const salesMonths = [...lastCompleteMonths(now, 12), monthKey(now)]
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS)

  const [stock, sales, dealer, openOrders, reviewed] = await Promise.all([
    prisma.inventory.findMany({
      where: { dealerId },
      orderBy: { product: { sku: 'asc' } },
      include: {
        product: { select: { id: true, sku: true, name: true, category: true, unitPrice: true, unitCost: true, warrantyYears: true } },
      },
    }),
    prisma.sale.findMany({
      where: { dealerId, month: { in: salesMonths } },
      select: { productId: true, month: true, units: true, revenue: true },
    }),
    prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { manufacturer: { select: { name: true, headquarters: true } } },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { dealerId, type: 'order', status: { in: ['submitted', 'approved', 'accepted'] } },
      _count: { _all: true },
    }),
    // Orders the manufacturer decided in the last 90 days (approval time).
    prisma.order.findMany({
      where: { dealerId, type: 'order', reviewedAt: { gte: ninetyDaysAgo, lte: now } },
      select: { createdAt: true, reviewedAt: true },
    }),
  ])

  // Sales per product per month.
  const salesOf = new Map()
  for (const row of sales) {
    if (!salesOf.has(row.productId)) salesOf.set(row.productId, new Map())
    salesOf.get(row.productId).set(row.month, row)
  }

  // Selling price = what the dealer actually charges its customers (salesService).
  const sellPrice = await sellingPrices(dealerId, stock.map((row) => row.product), now)

  const products = stock.map((row) => {
    const byMonth = salesOf.get(row.productId) ?? new Map()
    const monthly = months.map((month) => ({
      month,
      units: byMonth.get(month)?.units ?? 0,
      revenue: round2(byMonth.get(month)?.revenue ?? 0),
    }))
    const sales = salesMonths.map((month) => ({
      month,
      units: byMonth.get(month)?.units ?? 0,
      revenue: round2(byMonth.get(month)?.revenue ?? 0),
    }))
    const p = row.product
    const sellingPrice = sellPrice.get(p.id)
    return {
      product: p,
      onHand: row.onHand,
      onOrder: row.onOrder,
      reorderPoint: row.reorderPoint,
      updatedAt: row.updatedAt,
      status: stockStatus(row),
      sellingPrice,
      // Dealer's margin: selling price over the base price it pays.
      marginPct: sellingPrice > 0 ? round2(((sellingPrice - p.unitPrice) / sellingPrice) * 100) : 0,
      monthly,
      sales,
      unitsSold: monthly.reduce((sum, m) => sum + m.units, 0),
      revenue: round2(monthly.reduce((sum, m) => sum + m.revenue, 0)),
      // First vs last of the 3 months.
      unitsChangePct: changePct(monthly[0].units, monthly.at(-1).units),
    }
  })

  // Pricing summary: stock valued at selling price and at base price (cost).
  const prices = products.map((p) => p.sellingPrice)
  const stockValue = round2(products.reduce((sum, p) => sum + p.onHand * p.sellingPrice, 0))
  const stockCost = round2(products.reduce((sum, p) => sum + p.onHand * p.product.unitPrice, 0))
  const pricing = {
    stockValue,
    stockCost,
    // Profit the stock on hand would make if sold at the usual selling price.
    potentialMargin: round2(stockValue - stockCost),
    marginPct: stockValue > 0 ? round2(((stockValue - stockCost) / stockValue) * 100) : 0,
    // What the stock on order costs the dealer (base price).
    incomingValue: round2(products.reduce((sum, p) => sum + p.onOrder * p.product.unitPrice, 0)),
    averagePrice: prices.length ? round2(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
    lowestPrice: prices.length ? Math.min(...prices) : 0,
    highestPrice: prices.length ? Math.max(...prices) : 0,
    unitsOnHand: products.reduce((sum, p) => sum + p.onHand, 0),
  }

  // Units and revenue per month, all products together.
  const monthly = months.map((month, i) => ({
    month,
    units: products.reduce((sum, p) => sum + p.monthly[i].units, 0),
    revenue: round2(products.reduce((sum, p) => sum + p.monthly[i].revenue, 0)),
  }))

  const statusCount = Object.fromEntries(openOrders.map((g) => [g.status, g._count._all]))
  const approvalDays = reviewed.map((o) => (o.reviewedAt - o.createdAt) / DAY_MS)
  const orders = {
    awaitingApproval: statusCount.submitted ?? 0, // sent, the manufacturer has not decided yet
    quotesToAccept: statusCount.approved ?? 0, // approved and quoted, the dealer has to accept
    toFulfil: statusCount.accepted ?? 0, // accepted, waiting to be received
    unitsOnOrder: products.reduce((sum, p) => sum + p.onOrder, 0),
    productsOnOrder: products.filter((p) => p.onOrder > 0).length,
    avgApprovalDays: approvalDays.length ? round2(approvalDays.reduce((a, b) => a + b, 0) / approvalDays.length) : null,
    decidedLast90Days: approvalDays.length,
  }

  // Product-level insights over the last 3 complete months.
  const brief = (p) => p && { id: p.product.id, sku: p.product.sku, name: p.product.name }
  const bestSeller = [...products].sort((a, b) => b.unitsSold - a.unitsSold)[0]
  const growing = products
    .filter((p) => p.unitsChangePct !== null && p.monthly[0].units >= 2)
    .sort((a, b) => b.unitsChangePct - a.unitsChangePct)[0]
  const slowMovers = products.filter((p) => p.unitsSold === 0 && p.onHand > 0).sort((a, b) => b.onHand * b.product.unitPrice - a.onHand * a.product.unitPrice)
  const highestMargin = [...products].sort((a, b) => b.marginPct - a.marginPct)[0]
  const needReorder = products.filter((p) => p.status !== 'ok' && p.onOrder === 0)

  const insights = {
    bestSeller: bestSeller && bestSeller.unitsSold > 0 ? { ...brief(bestSeller), units: bestSeller.unitsSold, revenue: bestSeller.revenue } : null,
    fastestGrowing: growing && growing.unitsChangePct > 0
      ? { ...brief(growing), fromUnits: growing.monthly[0].units, toUnits: growing.monthly.at(-1).units, changePct: growing.unitsChangePct }
      : null,
    slowMovers: {
      count: slowMovers.length,
      value: round2(slowMovers.reduce((sum, p) => sum + p.onHand * p.product.unitPrice, 0)),
      top: slowMovers.slice(0, 3).map((p) => ({ ...brief(p), onHand: p.onHand })),
    },
    highestMargin: highestMargin ? { ...brief(highestMargin), marginPct: highestMargin.marginPct } : null,
    needReorder: { count: needReorder.length, top: needReorder.slice(0, 3).map(brief) },
  }

  return {
    asOf: now,
    months,
    salesMonths,
    pricing,
    products,
    monthly,
    orders,
    manufacturer: dealer?.manufacturer ?? null,
    insights,
  }
}
