import { prisma } from '../db/prisma.js'
import { CATEGORY_LABELS, STATUS_LABELS } from './vocabulary.js'
import { monthKey, monthLabel } from './period.js'

// Loads the records a metric is calculated from, for one dealer (or, on the
// manufacturer's Copilot, all its dealers: dealers = { in: [ids] }) and period,
// as flat rows with the same field names everywhere. The engine can then
// filter and group any of them by any field, so new question combinations
// need no new queries.
//
// Common fields: date, month, dealerId, dealer (name), customerId, customer (name), customerType, city
// sales:  orderId, product, sku, category, units, revenue, cost   (sales to customers, Place Orders)
// orders/quotes: id, status, total, units
// claims: id, status (= claim stage), product, sku, category, amount
// registrations: id, product, sku, category   (installed units; date = install date)

const customerFields = { select: { id: true, name: true, type: true, city: true } }
const dealerFields = { dealerId: true, dealer: { select: { name: true } } }
const productLabel = (p) => `${p.sku} · ${p.name}`

// Orders sent to the manufacturer since customers were removed have no
// customer (dealer <-> manufacturer only), so every customer field is optional.
const common = (date, customer, row) => ({
  date,
  month: monthKey(date),
  dealerId: row.dealerId,
  dealer: row.dealer.name,
  customerId: customer?.id ?? null,
  customer: customer?.name ?? 'No customer',
  customerType: customer?.type ?? null,
  city: customer?.city ?? null,
})

// Revenue = selling price paid by the customer; cost = base price the dealer
// paid the manufacturer. Each sale is one record (orderId = the sale).
async function salesFacts(dealers, period) {
  const sales = await prisma.dealerSale.findMany({
    where: { dealerId: dealers, createdAt: { gte: period.from, lt: period.to } },
    select: {
      ...dealerFields,
      id: true,
      quantity: true,
      basePrice: true,
      sellingPrice: true,
      createdAt: true,
      product: { select: { sku: true, name: true, category: true } },
    },
  })
  return sales.map((sale) => ({
    ...common(sale.createdAt, null, sale),
    orderId: `S-${sale.id}`,
    product: productLabel(sale.product),
    sku: sale.product.sku,
    category: sale.product.category,
    units: sale.quantity,
    revenue: sale.quantity * sale.sellingPrice,
    cost: sale.quantity * sale.basePrice,
  }))
}

async function orderFacts(dealers, period, type) {
  const orders = await prisma.order.findMany({
    where: { dealerId: dealers, type, createdAt: { gte: period.from, lt: period.to } },
    select: {
      ...dealerFields,
      id: true,
      status: true,
      total: true,
      createdAt: true,
      customer: customerFields,
      items: { select: { quantity: true } },
    },
  })
  return orders.map((order) => ({
    ...common(order.createdAt, order.customer, order),
    id: order.id,
    status: order.status,
    total: order.total,
    units: order.items.reduce((sum, item) => sum + item.quantity, 0),
  }))
}

async function claimFacts(dealers, period) {
  const claims = await prisma.claim.findMany({
    where: { dealerId: dealers, filedAt: { gte: period.from, lt: period.to } },
    select: {
      ...dealerFields,
      id: true,
      stage: true,
      amount: true,
      filedAt: true,
      product: { select: { sku: true, name: true, category: true } },
      customer: customerFields,
    },
  })
  return claims.map((claim) => ({
    ...common(claim.filedAt, claim.customer, claim),
    id: claim.id,
    status: claim.stage,
    amount: claim.amount,
    product: productLabel(claim.product),
    sku: claim.product.sku,
    category: claim.product.category,
  }))
}

async function registrationFacts(dealers, period) {
  const rows = await prisma.warrantyRegistration.findMany({
    where: { dealerId: dealers, installDate: { gte: period.from, lt: period.to } },
    select: {
      ...dealerFields,
      id: true,
      installDate: true,
      product: { select: { sku: true, name: true, category: true } },
      customer: customerFields,
    },
  })
  return rows.map((row) => ({
    ...common(row.installDate, row.customer, row),
    id: row.id,
    product: productLabel(row.product),
    sku: row.product.sku,
    category: row.product.category,
  }))
}

export function loadFacts(fact, dealers, period) {
  if (fact === 'sales') return salesFacts(dealers, period)
  if (fact === 'orders') return orderFacts(dealers, period, 'order')
  if (fact === 'quotes') return orderFacts(dealers, period, 'quote')
  if (fact === 'claims') return claimFacts(dealers, period)
  if (fact === 'registrations') return registrationFacts(dealers, period)
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
