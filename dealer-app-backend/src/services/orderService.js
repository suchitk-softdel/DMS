import { MANUFACTURER_DECISIONS, ORDER_TRANSITIONS } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { badRequest, forbidden, notFound } from '../utils/httpError.js'
import { refreshDealerAggregates } from './aggregationService.js'
import { logAudit } from './auditLog.js'

// Sortable list columns (FR-ORD-2).
export const ORDER_SORT_FIELDS = Object.freeze(['createdAt', 'total', 'id', 'customer', 'status'])
const orderBy = (sort, dir) =>
  sort === 'customer' ? [{ customer: { name: dir } }, { createdAt: 'desc' }] : [{ [sort]: dir }, { createdAt: 'desc' }]

// Status groups for the list filter (the exact status still shows per row).
//   draft: not sent; open: in progress; done: fulfilled orders and accepted
//   customer quotes; closed: rejected or declined.
export const ORDER_STAGES = Object.freeze(['draft', 'open', 'done', 'closed'])
const STAGE_WHERE = {
  draft: { status: 'draft' },
  open: {
    OR: [
      { type: 'order', status: { in: ['submitted', 'approved', 'accepted'] } },
      { type: 'quote', status: 'submitted' },
    ],
  },
  done: { OR: [{ type: 'order', status: 'fulfilled' }, { type: 'quote', status: 'approved' }] },
  closed: { status: { in: ['rejected', 'declined'] } },
}

// Orders and quotes for one dealer (SRS 3.4), newest first unless sorted.
export async function listOrders(dealerId, { type, status, stage, search, limit, offset, sort = 'createdAt', dir = 'desc' }) {
  const where = {
    dealerId,
    ...(type && { type }),
    ...(status && { status }),
    ...(stage && { AND: [STAGE_WHERE[stage]] }),
    ...(search && {
      OR: [{ id: { contains: search } }, { customer: { name: { contains: search } } }],
    }),
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: orderBy(sort, dir),
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        items: { select: { quantity: true } },
      },
    }),
  ])

  // itemCount: order lines; units: total quantity across the lines.
  return {
    total,
    items: rows.map(({ _count, items, dealerId: _d, customerId: _c, createdById: _u, ...order }) => ({
      ...order,
      itemCount: _count.items,
      units: items.reduce((sum, item) => sum + item.quantity, 0),
    })),
  }
}

export function getOrder(dealerId, orderId) {
  return prisma.order.findFirst({
    where: { id: orderId, dealerId },
    include: {
      customer: { select: { id: true, name: true, type: true, city: true } },
      reviewedBy: { select: { name: true } },
      dealerRespondedBy: { select: { name: true } },
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
// input.customerId is optional (past demo data had end customers; new order
// requests are dealer <-> manufacturer only).
export async function createOrder(user, input) {
  const { dealerId } = user
  let customer = null
  if (input.customerId) {
    customer = await prisma.customer.findFirst({ where: { id: input.customerId, dealerId } })
    if (!customer) throw badRequest('Customer not found for this dealership.')
  }

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
        customerId: customer?.id ?? null,
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

// Moves an order or quote to its next status. Every change re-runs the
// dealer's aggregates so KPIs, trends, forecast and incentives include it
// straight away. Fulfilled equipment units are then registered by the dealer
// one by one with their serial number and install date (Register Warranty,
// claimService.registerWarranty).
// Approving or rejecting an ORDER is the manufacturer's decision
// (manufacturerService.js); the dealer submits and fulfils.
// Marking a QUOTE accepted records the customer's acceptance, so it needs
// acceptance: { method, contact, note? } (how and by whom the customer accepted).
// Declining the manufacturer's quote on an ORDER needs a reason.
export async function updateOrderStatus(user, orderId, status, acceptance = null, reason = null) {
  const order = await prisma.order.findFirst({ where: { id: orderId, dealerId: user.dealerId } })
  if (!order) throw notFound('Order not found.')
  if (order.type === 'order' && MANUFACTURER_DECISIONS.includes(status)) {
    throw forbidden('Orders are approved or rejected by the manufacturer.')
  }
  const accepting = order.type === 'quote' && status === 'approved'
  if (accepting && !acceptance) {
    throw badRequest('Record how the customer accepted the quote and the customer contact.')
  }
  const responding = order.type === 'order' && (status === 'accepted' || status === 'declined')
  if (status === 'declined' && !reason) throw badRequest('Give a reason for declining the quote.')
  const allowed = ORDER_TRANSITIONS[order.type][order.status] ?? []
  if (!allowed.includes(status)) {
    throw badRequest(
      allowed.length
        ? `A ${order.status} ${order.type} can only move to: ${allowed.join(', ')}.`
        : `A ${order.status} ${order.type} cannot be changed.`,
    )
  }

  const now = new Date()
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status,
      updatedAt: now,
      ...(accepting && {
        reviewedById: user.id,
        reviewedAt: now,
        acceptanceMethod: acceptance.method,
        acceptanceContact: acceptance.contact,
        acceptanceNote: acceptance.note ?? null,
      }),
      ...(responding && {
        dealerRespondedById: user.id,
        dealerRespondedAt: now,
        declineReason: status === 'declined' ? reason : null,
      }),
    },
  })

  await refreshDealerAggregates(user.dealerId)
  await logAudit({
    userId: user.id,
    action: `${order.type}.status`,
    entity: 'Order',
    entityId: order.id,
    details: {
      from: order.status,
      to: status,
      ...(accepting && { acceptedBy: acceptance.contact, method: acceptance.method }),
      ...(status === 'declined' && { reason }),
    },
  })
  return getOrder(user.dealerId, order.id)
}
