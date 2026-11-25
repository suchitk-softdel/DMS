// One-time data step: adds customer-sales history (Place Orders) to a
// database that has none, so the demo has 2 years of dealer sales to show.
//
// For every fulfilled manufacturer order, the dealer sells the same units on
// to its customers: each order line becomes 1 to 3 sales, 5 to 45 days after
// the order date, at 15-30% above the base price the dealer paid (the order
// line's quoted price). Sold by one of the dealer's principals or sales reps.
// Sales that would fall after today are left out (those goods are still in
// stock). Stock levels are not changed: they are the current stock already.
//
// Fixed seed, so the same database always gets the same history. Runs only
// when the database has no Place Orders sales yet.
//
//   npx tsx scripts/add-sales-history.js                                  (dev.db)
//   DATABASE_URL=file:./prisma/demo.db npx tsx scripts/add-sales-history.js  (demo.db)

import { prisma } from '../src/db/prisma.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_DAYS = 5
const MAX_DAYS = 45
const MIN_MARKUP = 0.15
const MAX_MARKUP = 0.3

// Small seeded random number generator (mulberry32): same seed, same numbers.
function randomFrom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedOf = (text) => [...text].reduce((hash, ch) => (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0, 7)

// Splits a quantity into 1 to 3 parts (each at least 1).
function split(quantity, random) {
  const parts = Math.min(quantity, 1 + Math.floor(random() * 3))
  const sizes = Array(parts).fill(1)
  for (let left = quantity - parts; left > 0; left--) sizes[Math.floor(random() * parts)]++
  return sizes
}

async function main() {
  const existing = await prisma.dealerSale.count()
  if (existing) {
    console.log(`Skipped: this database already has ${existing} Place Orders sales.`)
    return
  }

  const now = new Date()
  const [items, sellers] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { type: 'order', status: 'fulfilled' } },
      orderBy: [{ orderId: 'asc' }, { id: 'asc' }],
      select: { id: true, productId: true, quantity: true, unitPrice: true, order: { select: { id: true, dealerId: true, createdAt: true } } },
    }),
    prisma.user.findMany({
      where: { dealerId: { not: null }, roleId: { in: ['principal', 'salesRep'] } },
      orderBy: { id: 'asc' },
      select: { id: true, dealerId: true },
    }),
  ])
  const sellersOf = new Map()
  for (const user of sellers) sellersOf.set(user.dealerId, [...(sellersOf.get(user.dealerId) ?? []), user.id])

  const data = []
  for (const item of items) {
    const random = randomFrom(seedOf(`${item.order.id}|${item.id}`))
    const dealerSellers = sellersOf.get(item.order.dealerId) ?? []
    for (const quantity of split(item.quantity, random)) {
      const days = MIN_DAYS + Math.floor(random() * (MAX_DAYS - MIN_DAYS + 1))
      const minutes = Math.floor(random() * 9 * 60) // during opening hours
      const createdAt = new Date(item.order.createdAt.getTime() + days * DAY_MS + minutes * 60 * 1000)
      const markup = MIN_MARKUP + random() * (MAX_MARKUP - MIN_MARKUP)
      const seller = dealerSellers.length ? dealerSellers[Math.floor(random() * dealerSellers.length)] : null
      if (createdAt > now) continue
      data.push({
        dealerId: item.order.dealerId,
        productId: item.productId,
        quantity,
        basePrice: item.unitPrice,
        // Whole dollars, always above the base price.
        sellingPrice: Math.max(Math.round(item.unitPrice * (1 + markup)), Math.floor(item.unitPrice) + 1),
        soldById: seller,
        createdAt,
      })
    }
  }

  // Oldest first, so ids follow the dates.
  data.sort((a, b) => a.createdAt - b.createdAt)
  await prisma.dealerSale.createMany({ data })

  const units = data.reduce((sum, s) => sum + s.quantity, 0)
  const revenue = data.reduce((sum, s) => sum + s.quantity * s.sellingPrice, 0)
  const cost = data.reduce((sum, s) => sum + s.quantity * s.basePrice, 0)
  console.log(`Added ${data.length} sales (${units} units) from ${items.length} fulfilled order lines.`)
  console.log(`Revenue $${Math.round(revenue).toLocaleString('en-US')}, cost $${Math.round(cost).toLocaleString('en-US')}, profit $${Math.round(revenue - cost).toLocaleString('en-US')}.`)
}

await main()
await prisma.$disconnect()
