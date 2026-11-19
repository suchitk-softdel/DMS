// Builds the Copilot's reply from engine results: plain-English text, an
// optional table, the evidence behind it (SRS FR-COP-3), one-click actions
// (FR-COP-4) and follow-up suggestions (FR-COP-5).

import { MODULES } from '../constants/domain.js'
import { CATEGORY_LABELS, DIMENSIONS, METRICS } from './vocabulary.js'

// Rounded to cents first, so the same amounts summed in a different order
// (floating-point noise) always show the same dollar figure.
const money = (v) => `$${Math.round(Math.round(v * 100) / 100).toLocaleString('en-US')}`
const number = (v) => Math.round(v).toLocaleString('en-US')
const fmt = (metric, v) => (METRICS[metric].format === 'money' ? money(v) : number(v))
const pct = (v) => `${Math.abs(v * 100).toFixed(1)}%`
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayMonth = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`

// "1 Jan – 31 Dec 2025", "1 Nov 2024 – 15 Nov 2026" (`to` is exclusive).
function rangeLabel(from, toExclusive) {
  const to = new Date(toExclusive.getTime() - 1)
  if (from.getUTCFullYear() <= 2000) return `all records up to ${dayMonth(to)} ${to.getUTCFullYear()}`
  return from.getUTCFullYear() === to.getUTCFullYear()
    ? `${dayMonth(from)} – ${dayMonth(to)} ${to.getUTCFullYear()}`
    : `${dayMonth(from)} ${from.getUTCFullYear()} – ${dayMonth(to)} ${to.getUTCFullYear()}`
}
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const STATE_LABEL = {
  pending: 'pending',
  draft: 'draft',
  submitted: 'submitted',
  underReview: 'under-review',
  approved: 'approved',
  fulfilled: 'fulfilled',
  settled: 'settled',
  rejected: 'rejected',
}

const FACT_ACTION = {
  sales: { label: 'Open Dealer 360', module: MODULES.DEALER_360 },
  orders: { label: 'View Orders', module: MODULES.ORDERS },
  quotes: { label: 'View Quotes', module: MODULES.ORDERS },
  claims: { label: 'View Claims', module: MODULES.WARRANTY },
  registrations: { label: 'View Warranty', module: MODULES.WARRANTY },
}

const periodPhrase = (period) => (period.kind === 'all' ? 'overall' : `in ${period.label}`)

// Category as a describing word: "furnace sales" (the plural is used for "36 furnaces").
const CATEGORY_ADJECTIVE = {
  airConditioner: 'air conditioner',
  heatPump: 'heat pump',
  furnace: 'furnace',
  airHandler: 'air handler',
  thermostat: 'thermostat',
  indoorAirQuality: 'indoor air quality',
  parts: 'parts',
}

// Count words read better in the singular for 1 ("1 claim").
const singularize = (word, value) => (Math.round(value) === 1 ? word.replace(/s$/, '') : word)

// "pending residential furnace" etc., placed before the metric name.
function filterWords(filters) {
  const words = []
  if (filters.state) words.push(STATE_LABEL[filters.state])
  if (filters.customerType) words.push(filters.customerType)
  if (filters.category) words.push(CATEGORY_ADJECTIVE[filters.category])
  if (filters.sku) words.push(filters.sku)
  return words.join(' ')
}

function filterSuffix(filters) {
  const parts = []
  if (filters.city) parts.push(`in ${filters.city}`)
  if (filters.customer) parts.push(`for ${filters.customer}`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}

// ["Sales", "Furnaces", "by product", "2025", "vs 2024"]: how the question
// was understood, shown as tags above the answer.
export function recipeTags(recipe) {
  const parts = [capitalize(METRICS[recipe.metric].label)]
  const f = recipe.filters
  if (f.state) parts.push(capitalize(STATE_LABEL[f.state]))
  if (f.category) parts.push(CATEGORY_LABELS[f.category])
  if (f.sku) parts.push(f.sku)
  if (f.customerType) parts.push(capitalize(f.customerType))
  if (f.city) parts.push(f.city)
  if (f.customer) parts.push(f.customer)
  if (recipe.groupBy) parts.push(`by ${DIMENSIONS[recipe.groupBy].label}`)
  parts.push(recipe.period.label)
  if (recipe.previousPeriod) parts.push(`vs ${recipe.previousPeriod.label}`)
  return parts
}

export const describeRecipe = (recipe) => recipeTags(recipe).join(' · ')

// The key number, shown big: { value, caption, change?: { direction, percent, vs } }
function highlightFor(recipe, result) {
  const { metric } = recipe
  const unit = metric === 'units' || metric === 'orderUnits' ? ' units' : ''
  const highlight = { value: `${fmt(metric, result.value)}${unit}`, caption: describeRecipe({ ...recipe, previousPeriod: null }) }
  if (recipe.previousPeriod && result.previous.value) {
    const change = result.value / result.previous.value - 1
    highlight.change = {
      direction: change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat',
      percent: pct(change),
      vs: `${fmt(metric, result.previous.value)} in ${recipe.previousPeriod.label}`,
    }
  }
  return highlight
}

function changeSentence(metric, current, previous, previousLabel) {
  if (!previous) return ` There was nothing to compare with in ${previousLabel}.`
  const change = current / previous - 1
  const direction = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat'
  return direction === 'flat'
    ? ` That's the same as ${previousLabel} (${fmt(metric, previous)}).`
    : ` That's ${direction} ${pct(change)} from ${fmt(metric, previous)} in ${previousLabel}.`
}

function evidenceFor(recipe, result) {
  const { fact } = METRICS[recipe.metric]
  const evidence = []
  if (fact === 'sales') evidence.push(`${number(result.orderCount)} fulfilled orders (${number(result.recordCount)} order lines)`)
  else evidence.push(`${number(result.recordCount)} ${fact === 'claims' ? 'claims' : fact}`)
  evidence.push(rangeLabel(recipe.period.from, recipe.period.to))
  if (recipe.previousPeriod) evidence.push(`compared with ${recipe.previousPeriod.label} (${number(result.previous.recordCount)} records)`)
  return evidence
}

function suggestionsFor(recipe) {
  const { fact } = METRICS[recipe.metric]
  const options = []
  if (!recipe.previousPeriod) options.push('Compare with last year')
  if (recipe.groupBy !== 'month') options.push('Show by month')
  if (!recipe.groupBy && DIMENSIONS.product.facts.includes(fact)) options.push('Break down by product')
  if (!recipe.groupBy && fact !== 'sales') options.push('Break down by status')
  if (fact === 'sales' && recipe.metric !== 'profit') options.push('What about profit?')
  return options.slice(0, 3)
}

export function queryAnswer(recipe, result) {
  const { metric, filters, period } = recipe
  const label = METRICS[metric].label
  const { fact } = METRICS[metric]
  const words = filterWords(filters)
  const subject = `${words ? `${words} ` : ''}${label}${filterSuffix(filters)}`
  let text

  if (recipe.groupBy && result.groups?.length) {
    const dimension = DIMENSIONS[recipe.groupBy].label
    const [first] = result.groups
    const isAvg = METRICS[metric].aggregate === 'avg'
    const share = result.value && !isAvg ? ` (${pct(first.value / result.value)} of the total)` : ''
    const totalWord = isAvg ? 'overall' : 'in total'
    if (recipe.groupBy === 'status' || recipe.groupBy === 'customerType') {
      // Few groups: list them all, largest first.
      text = `${capitalize(subject)} by ${dimension} ${periodPhrase(period)}: ${fmt(metric, result.value)} ${totalWord}, highest: ${first.label} (${fmt(metric, first.value)}).`
    } else if (recipe.groupBy === 'month') {
      // "worst month", "lowest month" -> name the lowest one instead.
      const lowest = recipe.sort === 'asc'
      const pick = [...result.groups].sort((a, b) => (lowest ? a.value - b.value : b.value - a.value))[0]
      text = `${capitalize(subject)} by month, ${period.label}: ${fmt(metric, result.value)} ${totalWord}. The ${lowest ? 'lowest' : 'highest'} month was ${pick.label} with ${fmt(metric, pick.value)}.`
    } else if (recipe.singular || recipe.limit === 1) {
      const isCount = !METRICS[metric].value
      const which = recipe.sort === 'asc' ? (isCount ? 'fewest' : 'lowest') : isCount ? 'most' : 'highest'
      text = `${first.label} had the ${which} ${subject} ${periodPhrase(period)}: ${fmt(metric, first.value)}${share}.`
    } else if (result.groups.length === result.groupCount) {
      // Every group is listed: describe it as a breakdown, not a "top N".
      text = `${capitalize(subject)} by ${dimension} ${periodPhrase(period)}: ${fmt(metric, result.value)} ${totalWord}. ${first.label} ${recipe.sort === 'asc' ? 'is lowest' : 'leads'} with ${fmt(metric, first.value)}${share}.`
    } else {
      text = `${recipe.sort === 'asc' ? 'Bottom' : 'Top'} ${result.groups.length} ${DIMENSIONS[recipe.groupBy].plural} by ${subject} ${periodPhrase(period)} (out of ${result.groupCount}):`
    }
  } else if (recipe.groupBy) {
    text = `I found no ${subject} ${periodPhrase(period)}.`
  } else if (metric === 'units') {
    // "You sold 36 furnaces in Q4 2025." / "You sold 12 units of FN-H96-80 ..."
    const what = filters.sku ? `units of ${filters.sku}` : filters.category ? CATEGORY_LABELS[filters.category].toLowerCase() : 'units'
    const type = filters.customerType ? ` to ${filters.customerType} customers` : ''
    text = `You sold ${number(result.value)} ${what}${type}${filterSuffix(filters)} ${periodPhrase(period)}.`
  } else if (metric === 'registrationCount') {
    text = `You installed and registered ${plural(result.value, 'unit')}${words ? ` (${words})` : ''}${filterSuffix(filters)} ${periodPhrase(period)}.`
  } else if (metric === 'orderUnits') {
    text = `Your ${subject} ${periodPhrase(period)}: ${number(result.value)} units.`
  } else if (METRICS[metric].value) {
    text = `Your ${subject} ${periodPhrase(period)} ${label.endsWith('s') ? 'were' : 'was'} ${fmt(metric, result.value)}.`
  } else {
    const verb = period.kind === 'all' || filters.state === 'pending' ? 'have' : 'had'
    const noun = `${words ? `${words} ` : ''}${singularize(label, result.value)}${filterSuffix(filters)}`
    text = `You ${verb} ${number(result.value)} ${noun} ${periodPhrase(period)}.`
  }

  if (recipe.previousPeriod) text += changeSentence(metric, result.value, result.previous.value, recipe.previousPeriod.label)
  if (result.ignored.length) {
    text += ` (Note: ${result.ignored.join(', ')} can't be applied to ${label}, so it was left out.)`
  }

  const grouped = recipe.groupBy && result.groups?.length
  const table = grouped
    ? {
        // Averages have no "share of total": show how many records each is based on.
        columns: [capitalize(DIMENSIONS[recipe.groupBy].label), capitalize(label), METRICS[metric].aggregate === 'avg' ? 'Records' : 'Share'],
        rows: result.groups.map((g) => [
          g.label,
          fmt(metric, g.value),
          METRICS[metric].aggregate === 'avg' ? number(g.count) : result.value ? pct(g.value / result.value) : '-',
        ]),
        // 0..1 per row, drawn as a small bar next to the share
        shares: METRICS[metric].aggregate === 'avg' ? null : result.groups.map((g) => (result.value ? g.value / result.value : 0)),
      }
    : null
  // Months are shown as a bar chart.
  const chart =
    grouped && recipe.groupBy === 'month'
      ? { points: result.groups.map((g) => ({ label: g.label, value: g.value, display: fmt(metric, g.value) })) }
      : null

  return {
    text,
    highlight: !grouped || recipe.groupBy === 'month' ? highlightFor(recipe, result) : null,
    chart,
    table,
    evidence: evidenceFor(recipe, result),
    understood: describeRecipe(recipe),
    tags: recipeTags(recipe),
    actions: [FACT_ACTION[fact]],
    suggestions: suggestionsFor(recipe),
  }
}

// ---------------------------------------------------------------------------
// Special answers (reuse the existing in-house models)
// ---------------------------------------------------------------------------

export function healthAnswer(health) {
  if (health.score === null) {
    return { text: 'There is not enough data yet to calculate your Health Score.', evidence: [], actions: [], suggestions: [] }
  }
  const scored = health.components.filter((c) => c.score !== null)
  const weakest = [...scored].sort((a, b) => a.score - b.score)[0]
  const strongest = [...scored].sort((a, b) => b.score - a.score)[0]
  return {
    text: `Your Health Score is ${health.score} out of 100. Strongest area: ${strongest.label} (${strongest.score}). Biggest opportunity: ${weakest.label} (${weakest.score}). ${weakest.evidence}`,
    table: {
      columns: ['Component', 'Weight', 'Score', 'Why'],
      rows: health.components.map((c) => [c.label, `${Math.round(c.weight * 100)}%`, c.score ?? '-', c.evidence]),
    },
    evidence: ['Weighted score of revenue growth, order velocity, warranty compliance and training completion'],
    understood: 'Health Score',
    tags: ['Health Score', 'today'],
    highlight: { value: `${health.score} / 100`, caption: 'Dealer Health Score' },
    actions: [{ label: 'Open Dealer 360', module: MODULES.DEALER_360 }],
    suggestions: ['Compare my sales with last year', 'How many claims are pending?', 'Show sales by month'],
  }
}

export function forecastAnswer(forecast) {
  const atRisk = forecast.items.filter((i) => i.shortfall > 0)
  const expected = forecast.items.reduce((sum, i) => sum + i.expected, 0)
  const growth = `${forecast.growth >= 1 ? '+' : '-'}${pct(forecast.growth - 1)}`
  const text = atRisk.length
    ? `${atRisk.length} ${atRisk.length === 1 ? 'product is' : 'products are'} likely to run short in the next 30 days: ${atRisk
        .slice(0, 3)
        .map((i) => `${i.product.sku} (about ${i.expected} needed, ${i.onHand + i.onOrder} available)`)
        .join(', ')}. I recommend reordering ${atRisk.length === 1 ? 'it' : 'them'} now.`
    : `Your stock covers the expected demand for the next 30 days (about ${expected} units in total). No reorder is needed right now.`
  const rows = (atRisk.length ? atRisk : forecast.items.filter((i) => i.expected > 0)).slice(0, 8)
  return {
    text,
    table: {
      columns: ['Product', 'Expected (30 days)', 'On hand', 'On order', 'Short by'],
      rows: rows.map((i) => [i.product.sku, i.expected, i.onHand, i.onOrder, Math.max(0, i.shortfall)]),
    },
    evidence: ['Forecast: units sold in the same month last year', `adjusted for your unit growth (${growth} over 12 months)`],
    understood: 'Demand forecast · next 30 days',
    tags: ['Demand forecast', 'next 30 days'],
    highlight: atRisk.length
      ? { value: `${atRisk.length} ${atRisk.length === 1 ? 'product' : 'products'}`, caption: 'likely to run short in the next 30 days' }
      : { value: `${expected} units`, caption: 'expected demand, fully covered by stock' },
    actions: [{ label: 'Place Reorder', module: MODULES.INVENTORY }],
    suggestions: ['Which products sold the most last month?', 'Show furnace sales by month', 'What is my health score?'],
  }
}

export function incentivesAnswer(programs) {
  const open = programs.filter((p) => p.nextMilestone).sort((a, b) => b.percentToNext - a.percentToNext)
  const earned = programs.reduce((sum, p) => sum + p.earned, 0)
  const unit = (p, v) => (p.metric === 'revenue' ? money(v) : p.metric === 'trainingHours' ? `${number(v)} hours` : `${number(v)} units`)
  const closest = open[0]
  const text = closest
    ? `You're closest to "${closest.name}": ${unit(closest, closest.current)} of ${unit(closest, closest.nextMilestone.target)} (${closest.percentToNext}%). Reaching it pays ${money(closest.nextMilestone.payout)}. You have earned ${money(earned)} across all programs so far.`
    : `You have reached every milestone in your current programs and earned ${money(earned)} in total.`
  return {
    text,
    table: {
      columns: ['Program', 'Progress', 'Next milestone', 'Payout', 'Rank'],
      rows: programs.map((p) => [
        p.name,
        unit(p, p.current),
        p.nextMilestone ? unit(p, p.nextMilestone.target) : 'All reached',
        p.nextMilestone ? money(p.nextMilestone.payout) : money(p.earned),
        p.peerRank ? `${p.peerRank} of ${p.peerCount}` : '-',
      ]),
    },
    evidence: ['Progress is calculated from your fulfilled orders and completed training'],
    understood: 'Incentive programs',
    tags: ['Incentive programs'],
    highlight: closest ? { value: `${closest.percentToNext}%`, caption: `to the next "${closest.name}" milestone` } : null,
    actions: [{ label: 'View Incentives', module: MODULES.INCENTIVES }],
    suggestions: ['How many heat pumps did I sell this year?', 'Show my sales by month', 'What is my health score?'],
  }
}

const EXAMPLES = {
  revenue: 'What were my total sales last year?',
  profit: 'Which products generated the highest profit?',
  units: 'How many units did I sell this year?',
  orders: 'How many orders are pending?',
  quotes: 'How many quotes did we send this month?',
  claims: 'How many claims are pending?',
  health: 'What is my health score?',
  forecast: 'What should I stock next month?',
  incentives: 'Which incentive am I closest to?',
}
const EXAMPLE_MODULE = {
  revenue: MODULES.DEALER_360,
  profit: MODULES.DEALER_360,
  units: MODULES.DEALER_360,
  orders: MODULES.ORDERS,
  quotes: MODULES.ORDERS,
  claims: MODULES.WARRANTY,
  health: MODULES.DEALER_360,
  forecast: MODULES.INVENTORY,
  incentives: MODULES.INCENTIVES,
}

export function examplesFor(can, intents = Object.keys(EXAMPLES)) {
  return intents.filter((i) => EXAMPLES[i] && can(EXAMPLE_MODULE[i])).map((i) => EXAMPLES[i])
}

export function greetingAnswer(can) {
  return {
    text: "Hi! I'm your Dealer Copilot. Ask me about your sales, profit, orders, quotes, warranty claims, stock, prices, training, sales pipeline and incentives, in your own words. Every answer comes from your dealership's own data, with the evidence shown.",
    evidence: [],
    actions: [],
    suggestions: examplesFor(can).slice(0, 4),
  }
}

export function clarifyAnswer(can, options) {
  const suggestions = examplesFor(can, options)
  return {
    text: suggestions.length
      ? "I'm not completely sure what you mean. Did you mean one of these?"
      : "I'm not sure what you mean. Try asking about sales, orders, claims, stock or incentives.",
    evidence: [],
    actions: [],
    suggestions: suggestions.length ? suggestions : examplesFor(can).slice(0, 3),
  }
}

export function unknownAnswer(can) {
  return {
    text: "I can only answer questions about your dealership's data: sales, profit, orders, quotes, warranty claims, installs, stock, prices, incentives, training, sales opportunities, customers, users, roles and the dealer network. I won't guess about anything else.",
    evidence: [],
    actions: [],
    suggestions: examplesFor(can).slice(0, 3),
  }
}

export function noAccessAnswer(what) {
  return {
    text: `Your account doesn't have access to ${what}, so I can't answer that.`,
    evidence: [],
    actions: [],
    suggestions: [],
  }
}


// ---------------------------------------------------------------------------
// Team, dealer network and customer list
// ---------------------------------------------------------------------------

const plural = (n, word) => `${number(n)} ${n === 1 ? word : `${word}s`}`

// The app shows two account types only: Dealer and Manufacturer (project
// decision). The finer dealer roles stay in the database for access rules.
const MANUFACTURER_ROLE = 'manufacturer'
const accountType = (roleId) => (roleId === MANUFACTURER_ROLE ? 'Manufacturer' : 'Dealer')

// users: [{ roleId }] of the signed-in user's dealership
export function teamAnswer(dealerName, users) {
  return {
    text: `${dealerName} has ${plural(users.length, 'user')} in the Dealer App.`,
    highlight: { value: plural(users.length, 'user'), caption: dealerName },
    table: { columns: ['Account type', 'Users'], rows: [['Dealer', users.length]] },
    evidence: ['User accounts of your dealership'],
    tags: ['Users', 'your dealership'],
    understood: 'Users · your dealership',
    actions: [],
    suggestions: ['How many customers do I have?', 'How many dealers are in the network?', 'What is my health score?'],
  }
}

// Network overview only: names and regions, never other dealers' figures.
export function networkAnswer(manufacturer, dealers, ownDealerId) {
  const active = dealers.filter((d) => d.status === 'active').length
  const regions = new Set(dealers.map((d) => d.region)).size
  return {
    text: `There are ${plural(dealers.length, 'dealer')} in the ${manufacturer.name} network, across ${plural(regions, 'region')}${active < dealers.length ? ` (${active} active)` : ''}. ${manufacturer.name} is based in ${manufacturer.headquarters}.`,
    highlight: { value: plural(dealers.length, 'dealer'), caption: `${manufacturer.name} network` },
    table: {
      columns: ['Dealer', 'Region', 'Tier', 'Status'],
      rows: dealers.map((d) => [`${d.name}${d.id === ownDealerId ? ' (you)' : ''}`, d.region, d.tier, d.status === 'onHold' ? 'On hold' : d.status === 'active' ? 'Active' : 'Pending']),
    },
    evidence: ['Dealer network of your manufacturer'],
    tags: ['Dealer network'],
    understood: 'Dealer network',
    actions: [],
    suggestions: ['Which incentive am I closest to?', 'What is my health score?', 'Compare my sales with last year'],
  }
}

// stats: { total, residential, commercial, activeThisYear, year }
export function customersAnswer(stats) {
  return {
    text: `You have ${plural(stats.total, 'customer')}: ${number(stats.residential)} residential and ${number(stats.commercial)} commercial. ${number(stats.activeThisYear)} of them have bought from you in ${stats.year} so far.`,
    highlight: { value: plural(stats.total, 'customer'), caption: 'your customer list' },
    table: {
      columns: ['Customer type', 'Customers'],
      rows: [['Residential', stats.residential], ['Commercial', stats.commercial]],
    },
    evidence: ['Your customer list', `customers with a fulfilled order in ${stats.year}`],
    tags: ['Customers', 'your dealership'],
    understood: 'Customers · your dealership',
    actions: [{ label: 'View Orders', module: MODULES.ORDERS }],
    suggestions: ['Top 5 customers by sales this year', 'Which customer placed the most orders?', 'Sales by customer type'],
  }
}

// roles: [{ id, name, permissions: [module] }], counts: { roleId: users at this dealership }
const MODULE_NAMES = {
  home: 'Home',
  dealer360: 'Dealer 360',
  orders: 'Orders',
  inventory: 'Inventory',
  warranty: 'Warranty & Claims',
  orderApprovals: 'Order Approvals',
}

export function rolesAnswer(roles, counts, myRoleId) {
  const mine = accountType(myRoleId)
  const types = ['Dealer', 'Manufacturer'].map((type) => {
    const ofType = roles.filter((r) => accountType(r.id) === type)
    const modules = [...new Set(ofType.flatMap((r) => r.permissions))].filter((m) => MODULE_NAMES[m])
    return {
      type,
      users: ofType.reduce((sum, r) => sum + (counts[r.id] ?? 0), 0),
      modules: (type === 'Dealer' ? ['Copilot'] : []).concat(modules.map((m) => MODULE_NAMES[m])),
    }
  })
  return {
    text: `There are 2 account types in the Dealer App: Dealer and Manufacturer. Dealers send orders and follow their business; the manufacturer approves the orders. You are signed in as a ${mine}.`,
    highlight: { value: '2 account types', caption: 'Dealer and Manufacturer' },
    table: {
      columns: ['Account type', 'Users here', 'Can open'],
      rows: types.map((t) => [`${t.type}${t.type === mine ? ' (you)' : ''}`, t.users, t.modules.join(', ')]),
    },
    evidence: ['Role permissions are stored in the database (SRS 6.7)'],
    tags: ['Account types'],
    understood: 'User roles',
    actions: [],
    suggestions: ['How many users are there?', 'How many dealers are in the network?', 'What can you do?'],
  }
}

// stats: { from, to, orders, quotes, claims, customers, joined }
export function coverageAnswer(stats) {
  const months = (stats.to.getUTCFullYear() - stats.from.getUTCFullYear()) * 12 + (stats.to.getUTCMonth() - stats.from.getUTCMonth()) + stats.to.getUTCDate() / 31
  const years = Math.round((months / 12) * 10) / 10
  const span = years >= 1 ? `${years} ${years === 1 ? 'year' : 'years'}` : `${Math.round(months)} months`
  const fmtDay = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  return {
    text: `You have about ${span} of data, from ${fmtDay(stats.from)} to ${fmtDay(stats.to)}${stats.joined ? ' (since your dealership joined the network)' : ''}. It covers ${plural(stats.orders, 'order')}, ${plural(stats.quotes, 'quote')}, ${plural(stats.claims, 'warranty claim')} and ${plural(stats.customers, 'customer')}.`,
    highlight: { value: span, caption: `of data · ${fmtDay(stats.from)} – ${fmtDay(stats.to)}` },
    table: {
      columns: ['Data', 'Records'],
      rows: [['Orders', number(stats.orders)], ['Quotes', number(stats.quotes)], ['Warranty claims', number(stats.claims)], ['Customers', number(stats.customers)]],
    },
    evidence: ['First and latest order dates in your data'],
    tags: ['Data coverage'],
    understood: 'Data coverage',
    actions: [],
    suggestions: ['Show sales by month', 'Compare my sales with last year', 'What were my total sales last year?'],
  }
}
