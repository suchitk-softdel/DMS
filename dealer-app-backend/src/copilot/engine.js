// Runs any recipe against the dealer's data. One generic engine instead of
// one function per question: load the records, filter, total, group, compare.

import { groupLabel, loadFacts } from './facts.js'
import { METRICS, STATE_WORDS } from './vocabulary.js'

const STATE_FACT = { orders: 'orders', quotes: 'orders', claims: 'claims' }

// -> { keep(record) -> boolean, ignored: [filter names that don't apply] }
function buildFilter(fact, filters) {
  const checks = []
  const ignored = []
  const fieldFilters = ['category', 'sku', 'city', 'customer', 'customerType']
  const fieldsOf = {
    sales: ['category', 'sku', 'city', 'customer', 'customerType'],
    orders: ['city', 'customer', 'customerType'],
    quotes: ['city', 'customer', 'customerType'],
    claims: ['category', 'sku', 'city', 'customer', 'customerType'],
    registrations: ['category', 'sku', 'city', 'customer', 'customerType'],
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

async function totalFor(dealerId, recipe, period) {
  const { fact } = METRICS[recipe.metric]
  const { keep, ignored } = buildFilter(fact, recipe.filters)
  const records = (await loadFacts(fact, dealerId, period)).filter(keep)
  return { records, value: aggregate(records, recipe.metric), ignored }
}

// -> { value, recordCount, orderCount?, groups?, previous?, ignored }
export async function runRecipe(dealerId, recipe) {
  const current = await totalFor(dealerId, recipe, recipe.period)
  const result = {
    value: current.value,
    recordCount: current.records.length,
    // Sales rows are order lines; count the distinct orders behind them.
    orderCount: METRICS[recipe.metric].fact === 'sales' ? new Set(current.records.map((r) => r.orderId)).size : null,
    ignored: current.ignored,
  }

  if (recipe.groupBy) {
    // Customers are grouped by ID: two different customers can share a name.
    const keyField = recipe.groupBy === 'customer' ? 'customerId' : recipe.groupBy
    const groups = new Map()
    for (const record of current.records) {
      const key = record[keyField]
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(record)
    }
    let rows = [...groups.entries()].map(([key, records]) => ({
      key,
      label: recipe.groupBy === 'customer' ? records[0].customer : groupLabel(recipe.groupBy, key),
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
    const previous = await totalFor(dealerId, recipe, recipe.previousPeriod)
    result.previous = { value: previous.value, recordCount: previous.records.length }
  }

  return result
}
