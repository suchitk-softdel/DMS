import { CLAIM_AGING_DAYS, MODULES } from '../constants/domain.js'
import { prisma } from '../db/prisma.js'
import { DAY_MS } from '../utils/query.js'
import { forecastDemand } from './forecastService.js'

// Notifications for the bell in the top bar. Worked out from the data each
// time (nothing is stored), so they always match what the screens show.
//
// Manufacturer: orders waiting for approval.
// Dealer: orders the manufacturer approved or rejected in the last 7 days,
// claims waiting too long, products about to run short (each only when the
// role can open that module).

const RECENT_DAYS = 7
const MAX_ITEMS = 8
const money = (value) => `$${Math.round(value).toLocaleString('en-US')}`
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`

async function manufacturerNotifications(user, now) {
  const where = { type: 'order', status: 'submitted', dealer: { manufacturerId: user.manufacturerId } }
  const [count, oldest] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: MAX_ITEMS,
      select: { id: true, total: true, createdAt: true, dealer: { select: { name: true } } },
    }),
  ])
  return {
    count,
    items: oldest.map((o) => {
      const days = Math.floor((now - o.createdAt) / DAY_MS)
      return {
        id: `approve-${o.id}`,
        kind: days > 2 ? 'warning' : 'info',
        title: `${o.id} waiting for approval`,
        detail: `${o.dealer.name} · ${money(o.total)} · ${days === 0 ? 'today' : `${plural(days, 'day')} ago`}`,
        at: o.createdAt,
        link: `/order-approvals?order=${o.id}`,
      }
    }),
  }
}

async function dealerNotifications(user, now) {
  const can = (module) => user.permissions.includes(module)
  const items = []

  if (can(MODULES.ORDERS)) {
    const decided = await prisma.order.findMany({
      where: {
        dealerId: user.dealerId,
        type: 'order',
        status: { in: ['approved', 'rejected'] },
        reviewedAt: { gte: new Date(now.getTime() - RECENT_DAYS * DAY_MS) },
      },
      orderBy: { reviewedAt: 'desc' },
      take: MAX_ITEMS,
      select: { id: true, status: true, total: true, reviewedAt: true, rejectionReason: true },
    })
    for (const o of decided) {
      items.push({
        id: `decided-${o.id}`,
        kind: o.status === 'approved' ? 'success' : 'error',
        title: `${o.id} ${o.status} by the manufacturer`,
        detail: o.status === 'approved' ? `${money(o.total)} · ready to fulfil` : `Reason: ${o.rejectionReason}`,
        at: o.reviewedAt,
        link: `/orders?order=${o.id}`,
      })
    }
  }

  if (can(MODULES.WARRANTY)) {
    const aging = await prisma.claim.count({
      where: {
        dealerId: user.dealerId,
        stage: { in: ['submitted', 'underReview'] },
        stageChangedAt: { lt: new Date(now.getTime() - CLAIM_AGING_DAYS * DAY_MS) },
      },
    })
    if (aging) {
      items.push({
        id: 'aging-claims',
        kind: 'warning',
        title: `${plural(aging, 'claim')} waiting more than ${CLAIM_AGING_DAYS} days`,
        detail: 'Follow up to avoid reimbursement delays',
        at: now,
        link: '/warranty',
      })
    }
  }

  if (can(MODULES.INVENTORY)) {
    const { items: forecast } = await forecastDemand(user.dealerId, now)
    const short = forecast.filter((i) => i.shortfall > 0)
    if (short.length) {
      items.push({
        id: 'stock-out',
        kind: 'warning',
        title: `${plural(short.length, 'product')} may run short in 30 days`,
        detail: short.slice(0, 3).map((i) => i.product.sku).join(', '),
        at: now,
        link: '/inventory',
      })
    }
  }

  return { count: items.length, items: items.slice(0, MAX_ITEMS) }
}

// -> { count, items: [{ id, kind: success|info|warning|error, title, detail, at, link }] }
export function getNotifications(user, now = new Date()) {
  return user.manufacturerId ? manufacturerNotifications(user, now) : dealerNotifications(user, now)
}
