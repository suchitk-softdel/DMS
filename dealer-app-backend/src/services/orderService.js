import { prisma } from '../db/prisma.js'

// Orders and quotes for one dealer (SRS 3.4), newest first.
export async function listOrders(dealerId, { type, status, search, limit, offset }) {
  const where = {
    dealerId,
    ...(type && { type }),
    ...(status && { status }),
    ...(search && {
      OR: [{ id: { contains: search } }, { customer: { name: { contains: search } } }],
    }),
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
  ])

  return {
    total,
    items: rows.map(({ _count, dealerId: _d, customerId: _c, createdById: _u, ...order }) => ({
      ...order,
      itemCount: _count.items,
    })),
  }
}

export function getOrder(dealerId, orderId) {
  return prisma.order.findFirst({
    where: { id: orderId, dealerId },
    include: {
      customer: { select: { id: true, name: true, type: true, city: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          product: { select: { id: true, sku: true, name: true, category: true } },
        },
      },
    },
  })
}
