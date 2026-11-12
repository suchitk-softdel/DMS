import { prisma } from '../db/prisma.js'

// Current stock per product for one dealer (SRS 3.5). Risk levels and reorder
// recommendations are AI-layer results and will be added separately.
export async function listInventory(dealerId) {
  const rows = await prisma.inventory.findMany({
    where: { dealerId },
    orderBy: { product: { sku: 'asc' } },
    include: { product: { select: { id: true, sku: true, name: true, category: true, unitCost: true } } },
  })
  return rows.map(({ id: _id, dealerId: _d, productId: _p, ...row }) => row)
}
