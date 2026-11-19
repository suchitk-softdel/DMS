import { prisma } from '../db/prisma.js'

// The dealer's product list with current stock (SRS 3.5). Project decision: the
// Inventory screen only lists products and stock; it is not connected to orders.
export async function listInventory(dealerId) {
  const rows = await prisma.inventory.findMany({
    where: { dealerId },
    orderBy: { product: { sku: 'asc' } },
    include: { product: { select: { id: true, sku: true, name: true, category: true, unitPrice: true, unitCost: true } } },
  })
  return rows.map(({ id: _id, dealerId: _d, productId: _p, ...row }) => row)
}
