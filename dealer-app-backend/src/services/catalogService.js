import { prisma } from '../db/prisma.js'

export async function listRoles() {
  const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } })
  return roles.map((role) => ({ ...role, permissions: JSON.parse(role.permissions) }))
}

export function getDealer(dealerId) {
  return prisma.dealer.findUnique({
    where: { id: dealerId },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      region: true,
      tier: true,
      status: true,
      territoryCoverage: true,
    },
  })
}

export function listProducts() {
  return prisma.product.findMany({
    orderBy: [{ category: 'asc' }, { sku: 'asc' }],
    select: { id: true, sku: true, name: true, category: true, unitPrice: true, packSize: true },
  })
}
