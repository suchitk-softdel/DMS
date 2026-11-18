import { prisma } from '../db/prisma.js'
import { CATEGORY_LABELS, STATUS_LABELS } from './vocabulary.js'
import { monthKey, monthLabel } from './period.js'

// Loads the records a metric is calculated from, for one dealer and period,
// as flat rows with the same field names everywhere. The engine can then
// filter and group any of them by any field, so new question combinations
// need no new queries.
//
// Common fields: date, month, customerId, customer (name), customerType, city
// sales:  orderId, product, sku, category, units, revenue, cost   (fulfilled order lines)
// orders/quotes: id, status, total, units
// claims: id, status (= claim stage), product, sku, category, amount
// registrations: id, product, sku, category   (installed units; date = install date)

const customerFields = { select: { id: true, name: true, type: true, city: true } }
const productLabel = (p) => `${p.sku} · ${p.name}`

const common = (date, customer) => ({
  date,
  month: monthKey(date),
  customerId: customer.id,
  customer: customer.name,
  customerType: customer.type,
  city: customer.city,
})

async function salesFacts(dealerId, period) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { dealerId, type: 'order', status: 'fulfilled', createdAt: { gte: period.from, lt: period.to } },
    },
    select: {
      quantity: true,
      unitPrice: true,
      product: { select: { sku: true, name: true, category: true, unitCost: true } },
      order: { select: { id: true, createdAt: true, customer: customerFields } },
    },
  })
  return items.map((item) => ({
    ...common(item.order.createdAt, item.order.customer),
    orderId: item.order.id,
    product: productLabel(item.product),
    sku: item.product.sku,
    category: item.product.category,
    units: item.quantity,
    revenue: item.quantity * item.unitPrice,
    cost: item.quantity * item.product.unitCost,
  }))
}

async function orderFacts(dealerId, period, type) {
  const orders = await prisma.order.findMany({
    where: { dealerId, type, createdAt: { gte: period.from, lt: period.to } },
    select: {
      id: true,
      status: true,
      total: true,
      createdAt: true,
      customer: customerFields,
      items: { select: { quantity: true } },
    },
  })
  return orders.map((order) => ({
    ...common(order.createdAt, order.customer),
    id: order.id,
    status: order.status,
    total: order.total,
    units: order.items.reduce((sum, item) => sum + item.quantity, 0),
  }))
}

async function claimFacts(dealerId, period) {
  const claims = await prisma.claim.findMany({
    where: { dealerId, filedAt: { gte: period.from, lt: period.to } },
    select: {
      id: true,
      stage: true,
      amount: true,
      filedAt: true,
      product: { select: { sku: true, name: true, category: true } },
      customer: customerFields,
    },
  })
  return claims.map((claim) => ({
    ...common(claim.filedAt, claim.customer),
    id: claim.id,
    status: claim.stage,
    amount: claim.amount,
    product: productLabel(claim.product),
    sku: claim.product.sku,
    category: claim.product.category,
  }))
}

async function registrationFacts(dealerId, period) {
  const rows = await prisma.warrantyRegistration.findMany({
    where: { dealerId, installDate: { gte: period.from, lt: period.to } },
    select: {
      id: true,
      installDate: true,
      product: { select: { sku: true, name: true, category: true } },
      customer: customerFields,
    },
  })
  return rows.map((row) => ({
    ...common(row.installDate, row.customer),
    id: row.id,
    product: productLabel(row.product),
    sku: row.product.sku,
    category: row.product.category,
  }))
}

export function loadFacts(fact, dealerId, period) {
  if (fact === 'sales') return salesFacts(dealerId, period)
  if (fact === 'orders') return orderFacts(dealerId, period, 'order')
  if (fact === 'quotes') return orderFacts(dealerId, period, 'quote')
  if (fact === 'claims') return claimFacts(dealerId, period)
  if (fact === 'registrations') return registrationFacts(dealerId, period)
  throw new Error(`Unknown fact "${fact}"`)
}

// How a group key is shown in answers.
export function groupLabel(dimension, key) {
  if (dimension === 'category') return CATEGORY_LABELS[key] ?? key
  if (dimension === 'status') return STATUS_LABELS[key] ?? key
  if (dimension === 'customerType') return key === 'residential' ? 'Residential' : 'Commercial'
  if (dimension === 'month') return monthLabel(key)
  return key
}
