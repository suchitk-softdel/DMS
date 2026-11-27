import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'
import { badRequest, notFound } from '../utils/httpError.js'
import { logAudit } from './auditLog.js'

// Manufacturer order desk (Order Approvals). Dealers send orders to the
// manufacturer; the manufacturer approves or rejects them with a reason, and
// the dealer then fulfils (installs) the approved ones.
//
// A manufacturer user sees the orders of its own dealer network only; every
// query below is limited to dealers of user.manufacturerId.

// Queues of the Order Approvals page.
//   pending: requests waiting for approval; approved: quoted, waiting for the
//   dealer; accepted: the dealer accepted the quote; closed: rejected by the
//   manufacturer or declined by the dealer; fulfilled: installed by the dealer.
export const APPROVAL_QUEUES = Object.freeze(['pending', 'approved', 'accepted', 'closed', 'fulfilled'])
const QUEUE_STATUS = {
  pending: 'submitted',
  approved: 'approved',
  accepted: 'accepted',
  closed: { in: ['rejected', 'declined'] },
  fulfilled: 'fulfilled',
}
const RECENT_DAYS = 30

const networkWhere = (manufacturerId) => ({ type: 'order', dealer: { manufacturerId } })
const round2 = (value) => Math.round(value * 100) / 100

const orderSelect = {
  id: true,
  status: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  dealerRespondedAt: true,
  declineReason: true,
  dealer: { select: { id: true, name: true, city: true, state: true, tier: true } },
  customer: { select: { name: true, type: true } },
  _count: { select: { items: true } },
  items: { select: { quantity: true } },
}

// itemCount: order lines; units: total quantity across the lines.
const toRow = ({ _count, items, ...order }) => ({
  ...order,
  itemCount: _count.items,
  units: items.reduce((sum, item) => sum + item.quantity, 0),
})

// queue: pending | approved | rejected | fulfilled. Pending: oldest first, so the
// longest-waiting orders are handled first; the others: newest decision first.
export async function listNetworkOrders(user, { queue = 'pending', dealerId, search, limit, offset }) {
  const where = {
    ...networkWhere(user.manufacturerId),
    status: QUEUE_STATUS[queue],
    ...(dealerId && { dealerId }),
    ...(search && {
      OR: [{ id: { contains: search } }, { customer: { name: { contains: search } } }, { dealer: { name: { contains: search } } }],
    }),
  }
  const orderBy =
    queue === 'pending'
      ? [{ createdAt: 'asc' }]
      : queue === 'fulfilled'
        ? [{ updatedAt: 'desc' }]
        : queue === 'accepted'
          ? [{ dealerRespondedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
          : [{ reviewedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy, take: limit, skip: offset, select: orderSelect }),
  ])
  return { total, items: rows.map(toRow) }
}

// -> { manufacturer, pending: { count, value, oldestDays }, approvedRecent, rejectedRecent,
//      counts: { pending, approved, accepted, closed, fulfilled },
//      network: { revenue: { value, orders }, pipeline: { value, orders }, dealers, activeDealers, claims },
//      dealers: [{ id, name, pending }] }
export async function getApprovalSummary(user, now = new Date()) {
  const where = networkWhere(user.manufacturerId)
  const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS)
  const [manufacturer, dealers, pending, oldest, groups, approvedRecent, rejectedRecent, byDealer, revenue, pipeline, claims] = await Promise.all([
    prisma.manufacturer.findUnique({ where: { id: user.manufacturerId }, select: { id: true, name: true } }),
    prisma.dealer.findMany({ where: { manufacturerId: user.manufacturerId }, orderBy: { name: 'asc' }, select: { id: true, name: true, status: true } }),
    prisma.order.aggregate({ where: { ...where, status: 'submitted' }, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.findFirst({ where: { ...where, status: 'submitted' }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.order.count({ where: { ...where, status: { in: ['approved', 'fulfilled'] }, reviewedAt: { gte: since } } }),
    prisma.order.count({ where: { ...where, status: { in: ['rejected', 'declined'] }, updatedAt: { gte: since } } }),
    prisma.order.groupBy({ by: ['dealerId'], where: { ...where, status: 'submitted' }, _count: { _all: true } }),
    // Revenue: orders the dealers confirmed at the manufacturer's price (accepted or fulfilled).
    prisma.order.aggregate({ where: { ...where, status: { in: ['accepted', 'fulfilled'] } }, _count: { _all: true }, _sum: { total: true } }),
    // Pipeline: quoted orders, waiting for the dealer to accept.
    prisma.order.aggregate({ where: { ...where, status: 'approved' }, _count: { _all: true }, _sum: { total: true } }),
    prisma.claim.count({ where: { dealer: { manufacturerId: user.manufacturerId } } }),
  ])
  const byStatus = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
  const pendingByDealer = Object.fromEntries(byDealer.map((g) => [g.dealerId, g._count._all]))

  return {
    manufacturer,
    pending: {
      count: pending._count._all,
      value: round2(pending._sum.total ?? 0),
      oldestDays: oldest ? Math.floor((now - oldest.createdAt) / DAY_MS) : null,
    },
    approvedRecent,
    rejectedRecent,
    recentDays: RECENT_DAYS,
    counts: {
      pending: byStatus.submitted ?? 0,
      approved: byStatus.approved ?? 0,
      accepted: byStatus.accepted ?? 0,
      closed: (byStatus.rejected ?? 0) + (byStatus.declined ?? 0),
      fulfilled: byStatus.fulfilled ?? 0,
    },
    // Network figures for the tiles at the top of Order Approvals.
    network: {
      revenue: { value: round2(revenue._sum.total ?? 0), orders: revenue._count._all },
      pipeline: { value: round2(pipeline._sum.total ?? 0), orders: pipeline._count._all },
      dealers: dealers.length,
      activeDealers: dealers.filter((d) => d.status === 'active').length,
      claims,
    },
    dealers: dealers.map(({ status: _status, ...d }) => ({ ...d, pending: pendingByDealer[d.id] ?? 0 })),
  }
}

export async function getNetworkOrder(user, orderId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...networkWhere(user.manufacturerId) },
    select: {
      ...orderSelect,
      reviewedBy: { select: { name: true } },
      createdBy: { select: { name: true } },
      dealerRespondedBy: { select: { name: true } },
      customer: { select: { name: true, type: true, city: true } },
      items: {
        select: { id: true, quantity: true, unitPrice: true, product: { select: { id: true, sku: true, name: true, category: true } } },
      },
    },
  })
  if (!order) return null
  const { _count, ...rest } = order
  return { ...rest, itemCount: _count.items, units: order.items.reduce((sum, item) => sum + item.quantity, 0) }
}

// Approve or reject a submitted order. Only orders still waiting can be
// decided, so two people can't decide the same order twice. Approving sends
// the dealer a quote: every line is priced at the current catalogue price.
async function decide(user, orderId, status, reason) {
  const order = await prisma.order.findFirst({ where: { id: orderId, ...networkWhere(user.manufacturerId) } })
  if (!order) throw notFound('Order not found.')
  if (order.status !== 'submitted') throw badRequest(`Order ${order.id} is ${order.status}; only submitted orders can be approved or rejected.`)

  const now = new Date()
  const count = await prisma.$transaction(async (tx) => {
    let total = order.total
    if (status === 'approved') {
      const lines = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { id: true, quantity: true, product: { select: { unitPrice: true } } } })
      for (const line of lines) await tx.orderItem.update({ where: { id: line.id }, data: { unitPrice: line.product.unitPrice } })
      total = Math.round(lines.reduce((sum, line) => sum + line.quantity * line.product.unitPrice, 0) * 100) / 100
    }
    const result = await tx.order.updateMany({
      where: { id: order.id, status: 'submitted' },
      data: { status, total, reviewedById: user.id, reviewedAt: now, rejectionReason: reason ?? null, updatedAt: now },
    })
    if (result.count === 0) throw badRequest(`Order ${order.id} was already decided.`)
    return result.count
  })
  if (count === 0) throw badRequest(`Order ${order.id} was already decided.`)

  await logAudit({
    userId: user.id,
    action: 'order.status',
    entity: 'Order',
    entityId: order.id,
    details: { from: 'submitted', to: status, ...(reason && { reason }) },
  })
  return getNetworkOrder(user, order.id)
}

export const approveOrder = (user, orderId) => decide(user, orderId, 'approved')
export const rejectOrder = (user, orderId, reason) => decide(user, orderId, 'rejected', reason)
