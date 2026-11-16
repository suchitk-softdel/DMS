import { EQUIPMENT_CATEGORIES, ORDER_TRANSITIONS } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { badRequest, notFound } from '../utils/httpError.js'
import { refreshDealerAggregates } from './aggregationService.js'
import { logAudit } from './auditLog.js'

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

// Next number in the shared ORD-/QT- sequence.
async function nextOrderNumber(tx) {
  const [{ maxSeq }] = await tx.$queryRaw`
    SELECT MAX(CAST(substr(id, instr(id, '-') + 1) AS INTEGER)) AS maxSeq FROM "Order"`
  return Number(maxSeq ?? 100000) + 1
}

// Creates a quote or order at list price.
// input: { type, customerId, status: 'draft' | 'submitted', items: [{ productId, quantity }] }
export async function createOrder(user, input) {
  const { dealerId } = user
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, dealerId } })
  if (!customer) throw badRequest('Customer not found for this dealership.')

  const productIds = input.items.map((item) => item.productId)
  if (new Set(productIds).size !== productIds.length) throw badRequest('Each product can appear only once.')
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  if (products.length !== productIds.length) throw badRequest('One or more products do not exist.')
  const priceOf = new Map(products.map((p) => [p.id, p.unitPrice]))

  const items = input.items.map((item) => ({ ...item, unitPrice: priceOf.get(item.productId) }))
  const total = Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100
  const now = new Date()

  const order = await prisma.$transaction(async (tx) => {
    const id = `${input.type === 'quote' ? 'QT' : 'ORD'}-${await nextOrderNumber(tx)}`
    return tx.order.create({
      data: {
        id,
        dealerId,
        customerId: customer.id,
        createdById: user.id,
        type: input.type,
        status: input.status,
        total,
        createdAt: now,
        updatedAt: now,
        items: { create: items },
      },
    })
  })

  await logAudit({ userId: user.id, action: `${input.type}.create`, entity: 'Order', entityId: order.id, details: { total } })
  return getOrder(dealerId, order.id)
}

// One warranty registration per equipment unit when an order is fulfilled
// (the unit is installed and registered with the manufacturer).
async function registerFulfilledUnits(tx, order, now) {
  const items = await tx.orderItem.findMany({
    where: { orderId: order.id, product: { category: { in: [...EQUIPMENT_CATEGORIES] } } },
    select: { id: true, productId: true, quantity: true },
  })
  const [{ maxSerial }] = await tx.$queryRaw`
    SELECT MAX(CAST(substr(serialNumber, 3) AS INTEGER)) AS maxSerial FROM "WarrantyRegistration"`
  let serial = Number(maxSerial ?? 5000000)

  const rows = items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => {
      const serialNumber = `SN${++serial}`
      return {
        id: `wr-${serialNumber}`,
        dealerId: order.dealerId,
        orderId: order.id,
        orderItemId: item.id,
        productId: item.productId,
        customerId: order.customerId,
        serialNumber,
        installDate: now,
        createdAt: now,
      }
    }),
  )
  if (rows.length) await tx.warrantyRegistration.createMany({ data: rows })
  return rows.length
}

// Moves an order or quote to its next status. Fulfilling an order registers
// its equipment units, and every change re-runs the dealer's aggregates so
// KPIs, trends, forecast and incentives include it straight away.
export async function updateOrderStatus(user, orderId, status) {
  const order = await prisma.order.findFirst({ where: { id: orderId, dealerId: user.dealerId } })
  if (!order) throw notFound('Order not found.')
  const allowed = ORDER_TRANSITIONS[order.type][order.status] ?? []
  if (!allowed.includes(status)) {
    throw badRequest(
      allowed.length
        ? `A ${order.status} ${order.type} can only move to: ${allowed.join(', ')}.`
        : `A ${order.status} ${order.type} cannot be changed.`,
    )
  }

  const now = new Date()
  const registered = await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status, updatedAt: now } })
    return status === 'fulfilled' ? registerFulfilledUnits(tx, order, now) : 0
  })

  await refreshDealerAggregates(user.dealerId)
  await logAudit({
    userId: user.id,
    action: `${order.type}.status`,
    entity: 'Order',
    entityId: order.id,
    details: { from: order.status, to: status, ...(registered && { unitsRegistered: registered }) },
  })
  return getOrder(user.dealerId, order.id)
}
