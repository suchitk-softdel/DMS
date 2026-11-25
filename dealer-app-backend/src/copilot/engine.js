// Runs any recipe against the dealer's data (or, for the manufacturer, all
// its dealers' data: dealers = { in: [ids] }). One generic engine instead of
// one function per question: load the records, filter, total, group, compare.

import { groupLabel, loadFacts } from './facts.js'
import { previousYear } from './period.js'
import { METRICS, STATE_WORDS } from './vocabulary.js'

const STATE_FACT = { orders: 'orders', quotes: 'orders', claims: 'claims' }
const CUSTOMER_DIMENSIONS = ['customer', 'customerType', 'city']

// -> { keep(record) -> boolean, ignored: [filter names that don't apply] }
function buildFilter(fact, filters) {
  const checks = []
  const ignored = []
  const fieldFilters = ['category', 'sku', 'city', 'customer', 'customerType', 'dealerId']
  const fieldsOf = {
    // Sales to customers (Place Orders) record the product, not the customer.
    sales: ['category', 'sku', 'dealerId'],
    orders: ['city', 'customer', 'customerType', 'dealerId'],
    quotes: ['city', 'customer', 'customerType', 'dealerId'],
    claims: ['category', 'sku', 'city', 'customer', 'customerType', 'dealerId'],
    registrations: ['category', 'sku', 'city', 'customer', 'customerType', 'dealerId'],
  }

  for (const field of fieldFilters) {
    if (filters[field] === undefined) continue
    if (fieldsOf[fact].includes(field)) checks.push((r) => r[field] === filters[field])
    else ignored.push(field)
  }

  if (filters.state) {
    const statuses = STATE_WORDS[filters.state]?.[STATE_FACT[fact]]
    if (statuses) checks.push((r) => statuses.includes(r.status))
    else ignored.push('state')
  } else if (fact === 'orders' || fact === 'quotes') {
    checks.push((r) => !['draft', 'rejected', 'declined'].includes(r.status)) // drafts, rejected and declined orders are not real orders
  }

  return { keep: (r) => checks.every((check) => check(r)), ignored }
}

function aggregate(records, metric) {
  const { value, aggregate: kind } = METRICS[metric]
  if (!value) return records.length
  const sum = records.reduce((total, r) => total + value(r), 0)
  return kind === 'avg' ? (records.length ? sum / records.length : 0) : sum
}

async function totalFor(dealers, recipe, period) {
  const { fact } = METRICS[recipe.metric]
  const { keep, ignored } = buildFilter(fact, recipe.filters)
  const records = (await loadFacts(fact, dealers, period)).filter(keep)
  return { records, value: aggregate(records, recipe.metric), ignored }
}

// -> { value, recordCount, orderCount?, groups?, previous?, ignored }
export async function runRecipe(dealers, recipe) {
  const current = await totalFor(dealers, recipe, recipe.period)
  const result = {
    value: current.value,
    recordCount: current.records.length,
    // Sales rows are order lines; count the distinct orders behind them.
    orderCount: METRICS[recipe.metric].fact === 'sales' ? new Set(current.records.map((r) => r.orderId)).size : null,
    ignored: current.ignored,
  }

  if (recipe.groupBy && METRICS[recipe.metric].fact === 'sales' && CUSTOMER_DIMENSIONS.includes(recipe.groupBy)) {
    // Sales don't record the customer: say so instead of one "No customer" group.
    result.unsupportedGroup = true
  } else if (recipe.groupBy) {
    // Customers and dealers are grouped by ID: two can share a name.
    const keyField = recipe.groupBy === 'customer' ? 'customerId' : recipe.groupBy === 'dealer' ? 'dealerId' : recipe.groupBy
    const groups = new Map()
    for (const record of current.records) {
      const key = record[keyField]
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(record)
    }
    let rows = [...groups.entries()].map(([key, records]) => ({
      key,
      label: recipe.groupBy === 'customer' ? records[0].customer : recipe.groupBy === 'dealer' ? records[0].dealer : groupLabel(recipe.groupBy, key),
      city: records[0].city,
      value: aggregate(records, recipe.metric),
      count: records.length,
    }))
    if (recipe.groupBy === 'customer') {
      // Same name twice: add the city so the answer is unambiguous.
      const nameCounts = new Map()
      for (const row of rows) nameCounts.set(row.label, (nameCounts.get(row.label) ?? 0) + 1)
      for (const row of rows) if (nameCounts.get(row.label) > 1) row.label = `${row.label} (${row.city})`
    }
    if (recipe.groupBy === 'month') {
      rows.sort((a, b) => a.key.localeCompare(b.key))
    } else if (recipe.groupBy === 'status' || recipe.groupBy === 'customerType') {
      rows.sort((a, b) => b.value - a.value)
    } else {
      rows.sort((a, b) => (recipe.sort === 'asc' ? a.value - b.value : b.value - a.value))
      rows = rows.slice(0, recipe.limit)
    }
    result.groups = rows
    result.groupCount = groups.size
  }

  if (recipe.previousPeriod) {
    const previous = await totalFor(dealers, recipe, recipe.previousPeriod)
    result.previous = { value: previous.value, recordCount: previous.records.length }
  }

  // Month charts also show the same months one year earlier, keyed by the
  // month they are compared with: lastYearByMonth['2026-03'] = March 2025.
  if (recipe.groupBy === 'month' && recipe.period.kind !== 'all') {
    const lastYear = await totalFor(dealers, recipe, previousYear(recipe.period))
    const byMonth = new Map()
    for (const record of lastYear.records) {
      const key = `${Number(record.month.slice(0, 4)) + 1}${record.month.slice(4)}`
      if (!byMonth.has(key)) byMonth.set(key, [])
      byMonth.get(key).push(record)
    }
    result.lastYearByMonth = Object.fromEntries([...byMonth].map(([key, records]) => [key, aggregate(records, recipe.metric)]))
    result.lastYearValue = lastYear.value
  }

  return result
}

// The records an answer is calculated from (same filters and period), for
// "Based on: N records" -> open the records.
export async function recordsFor(dealers, recipe) {
  const { fact } = METRICS[recipe.metric]
  const { keep } = buildFilter(fact, recipe.filters)
  return (await loadFacts(fact, dealers, recipe.period)).filter(keep)
}
