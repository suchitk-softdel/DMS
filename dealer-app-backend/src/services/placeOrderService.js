import { prisma } from '../db/prisma.js'
import { badRequest, HttpError, notFound } from '../utils/httpError.js'
import { refreshDealerAggregates } from './aggregationService.js'
import { logAudit } from './auditLog.js'
import { stockStatus } from './inventoryService.js'

// Place Orders: the dealer sells products from its own stock to customers.
// Rules:
//   - only products on hand can be sold, and never more than is on hand
//   - the selling price must be higher than the base price (the
//     manufacturer's price for the product, Product.unitPrice)
//   - each sale takes the units off the dealer's stock
//   - sales are the dealer's revenue: Home, Dealer 360, Inventory and the
//     Copilot read them (through the monthly Sale summary)

const RECENT_SALES = 10
const round2 = (value) => Math.round(value * 100) / 100

const toSale = (row) => ({
  id: row.id,
  product: row.product,
  quantity: row.quantity,
  basePrice: row.basePrice,
  sellingPrice: row.sellingPrice,
  total: round2(row.quantity * row.sellingPrice),
  profit: round2(row.quantity * (row.sellingPrice - row.basePrice)),
  soldBy: row.soldBy?.name ?? null,
  createdAt: row.createdAt,
})

const SALE_INCLUDE = {
  product: { select: { id: true, sku: true, name: true } },
  soldBy: { select: { name: true } },
}

// Everything the Place Orders screen shows:
//   products - each product with available quantity, base price, status and
//              the dealer's last selling price for it (to fill the form)
//   recent   - the dealer's latest sales
export async function getPlaceOrders(dealerId) {
  const [stock, recent, lastPrices] = await Promise.all([
    prisma.inventory.findMany({
      where: { dealerId },
      orderBy: { product: { sku: 'asc' } },
      include: { product: { select: { id: true, sku: true, name: true, category: true, unitPrice: true } } },
    }),
    prisma.dealerSale.findMany({ where: { dealerId }, orderBy: { id: 'desc' }, take: RECENT_SALES, include: SALE_INCLUDE }),
    prisma.dealerSale.findMany({ where: { dealerId }, orderBy: { id: 'desc' }, select: { productId: true, sellingPrice: true } }),
  ])

  const lastPriceOf = new Map()
  for (const row of lastPrices) if (!lastPriceOf.has(row.productId)) lastPriceOf.set(row.productId, row.sellingPrice)

  return {
    products: stock.map((row) => ({
      productId: row.product.id,
      sku: row.product.sku,
      name: row.product.name,
      category: row.product.category,
      available: row.onHand,
      status: stockStatus(row),
      basePrice: row.product.unitPrice,
      lastSellingPrice: lastPriceOf.get(row.product.id) ?? null,
    })),
    recent: recent.map(toSale),
  }
}

// Sells `quantity` units of a product at `sellingPrice`. Checks the rules
// and takes the units off stock in one transaction, so two sales at the same
// time can't sell the same units twice.
export async function placeOrder(user, { productId, quantity, sellingPrice }) {
  const sale = await prisma.$transaction(async (tx) => {
    const stock = await tx.inventory.findUnique({
      where: { dealerId_productId: { dealerId: user.dealerId, productId } },
      include: { product: { select: { name: true, unitPrice: true } } },
    })
    if (!stock) throw notFound('This product is not in your stock.')
    const { name, unitPrice: basePrice } = stock.product
    if (stock.onHand === 0) throw badRequest(`${name} is out of stock and can't be sold.`)
    if (quantity > stock.onHand) throw badRequest(`Only ${stock.onHand} of ${name} available.`)
    if (sellingPrice <= basePrice) throw badRequest(`Selling price must be higher than the base price ($${basePrice.toFixed(2)}).`)

    // Only take the units if they are still there (another sale may have
    // taken them since the check above).
    const taken = await tx.inventory.updateMany({
      where: { id: stock.id, onHand: { gte: quantity } },
      data: { onHand: { decrement: quantity }, updatedAt: new Date() },
    })
    if (taken.count === 0) throw new HttpError(409, 'The stock changed. Please try again.')

    return tx.dealerSale.create({
      data: { dealerId: user.dealerId, productId, quantity, basePrice, sellingPrice, soldById: user.id },
      include: SALE_INCLUDE,
    })
  })

  // Revenue figures include the sale straight away.
  await refreshDealerAggregates(user.dealerId)
  await logAudit({ userId: user.id, action: 'sales.placed', entity: 'DealerSale', entityId: String(sale.id), details: { productId, quantity } })
  return toSale(sale)
}
