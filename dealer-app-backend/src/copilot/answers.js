// Builds the Copilot's reply from engine results: plain-English text, an
// optional table, the evidence behind it (SRS FR-COP-3), one-click actions
// (FR-COP-4) and follow-up suggestions (FR-COP-5).

import { MODULES } from '../constants/domain.js'
import { CATEGORY_LABELS, DIMENSIONS, METRICS, dimensionsFor } from './vocabulary.js'

// Rounded to cents first, so the same amounts summed in a different order
// (floating-point noise) always show the same dollar figure.
// money(1234.5) -> "$1,235"
const money = (v) => `$${Math.round(Math.round(v * 100) / 100).toLocaleString('en-US')}`
// number(1234.5) -> "1,235"
const number = (v) => Math.round(v).toLocaleString('en-US')
// Formats a value as money or a plain number, depending on the metric.
const fmt = (metric, v) => (METRICS[metric].format === 'money' ? money(v) : number(v))
// pct(0.125) -> "12.5%" (always positive; the sign is said in words: up/down).
const pct = (v) => `${Math.abs(v * 100).toFixed(1)}%`
// Short month names for dates in the evidence.
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// dayMonth(date) -> "5 Mar"
const dayMonth = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`

// "1 Jan – 31 Dec 2025", "1 Nov 2024 – 15 Nov 2026" (`to` is exclusive).
function rangeLabel(from, toExclusive) {
  const to = new Date(toExclusive.getTime() - 1)
  if (from.getUTCFullYear() <= 2000) return `all records up to ${dayMonth(to)} ${to.getUTCFullYear()}`
  return from.getUTCFullYear() === to.getUTCFullYear()
    ? `${dayMonth(from)} – ${dayMonth(to)} ${to.getUTCFullYear()}`
    : `${dayMonth(from)} ${from.getUTCFullYear()} – ${dayMonth(to)} ${to.getUTCFullYear()}`
}
const round1 = (v) => Math.round(v * 10) / 10
// capitalize("sales") -> "Sales"
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// How each status filter is written in a sentence, e.g. "pending claims".
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

// The button shown under an answer: which screen to open for each kind of data.
const FACT_ACTION = {
  sales: { label: 'Open Dealer 360', module: MODULES.DEALER_360 },
  orders: { label: 'View Orders', module: MODULES.ORDERS },
  quotes: { label: 'View Quotes', module: MODULES.ORDERS },
  claims: { label: 'View Claims', module: MODULES.WARRANTY },
  registrations: { label: 'View Warranty', module: MODULES.WARRANTY },
}
// The manufacturer's Copilot: its Order Approvals screen (orders, quotes and
// dealer claim insights). Sales and installs have no manufacturer screen.
const NETWORK_ACTION = {
  orders: { label: 'Open Order Approvals', module: MODULES.ORDER_APPROVALS },
  quotes: { label: 'Open Order Approvals', module: MODULES.ORDER_APPROVALS },
  claims: { label: 'Open claim insights', module: MODULES.ORDER_APPROVALS },
}

// "in 2025", "in Q3 2025" or "overall" (for all time).
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

// "1 claims" -> "1 claim": count words read better in the singular for 1.
const singularize = (word, value) => (Math.round(value) === 1 ? word.replace(/s$/, '') : word)

// "pending residential furnace": status, customer type, category and SKU filters,
// placed before the metric name.
function filterWords(filters) {
  const words = []
  if (filters.state) words.push(STATE_LABEL[filters.state])
  if (filters.customerType) words.push(filters.customerType)
  if (filters.category) words.push(CATEGORY_ADJECTIVE[filters.category])
  if (filters.sku) words.push(filters.sku)
  return words.join(' ')
}

// " in Denver", " for ABC Homes": city and customer filters, placed after the metric name.
function filterSuffix(filters, { dealer = true } = {}) {
  const parts = []
  if (dealer && filters.dealerName) parts.push(`at ${filters.dealerName}`)
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
  if (f.dealerName) parts.push(f.dealerName)
  if (recipe.groupBy) parts.push(`by ${DIMENSIONS[recipe.groupBy].label}`)
  parts.push(recipe.period.label)
  if (recipe.previousPeriod) parts.push(`vs ${recipe.previousPeriod.label}`)
  return parts
}

// The same tags as one line: "Sales · Furnaces · 2025" (the "Understood as" text).
export const describeRecipe = (recipe) => recipeTags(recipe).join(' · ')

// The key number shown big at the top of the answer, with the % change when
// comparing: { value, caption, change?: { direction, percent, vs } }
// A month chart without "compare" still knows last year's months, so the
// change is shown too.
function highlightFor(recipe, result, chart) {
  const { metric } = recipe
  const unit = metric === 'units' || metric === 'orderUnits' ? ' units' : ''
  const highlight = { value: `${fmt(metric, result.value)}${unit}`, caption: describeRecipe({ ...recipe, previousPeriod: null }) }
  const previous = recipe.previousPeriod
    ? { value: result.previous.value, label: recipe.previousPeriod.label }
    : chart?.previousLabel && result.lastYearValue
      ? { value: result.lastYearValue, label: chart.previousLabel === 'Year before' ? 'the year before' : chart.previousLabel }
      : null
  if (previous?.value) {
    const change = result.value / previous.value - 1
    highlight.change = {
      direction: change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat',
      percent: pct(change),
      vs: `${fmt(metric, previous.value)} in ${previous.label}`,
    }
  }
  return highlight
}

// Month chart: every month of the period (empty months as 0), the same month
// a year earlier, the month still in progress ("to date") and the best month.
function monthKeysOf(period) {
  const keys = []
  const end = new Date(period.to.getTime() - 1)
  let date = new Date(Date.UTC(period.from.getUTCFullYear(), period.from.getUTCMonth(), 1))
  while (date <= end && keys.length < 36) {
    keys.push(date.toISOString().slice(0, 7))
    date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
  }
  return keys
}

function monthChart(recipe, result) {
  const { metric, period } = recipe
  const byKey = new Map(result.groups.map((g) => [g.key, g.value]))
  const keys = period.kind === 'all' ? [...byKey.keys()].sort() : monthKeysOf(period)
  // The period ends mid-month (e.g. "2026 so far"): its last month is partial.
  const partialKey = period.to.getUTCDate() === 1 ? null : new Date(period.to.getTime() - 1).toISOString().slice(0, 7)
  const lastYear = result.lastYearByMonth ?? null
  const points = keys.map((key) => {
    const value = byKey.get(key) ?? 0
    const previous = lastYear ? (lastYear[key] ?? 0) : null
    return {
      key,
      label: MONTH_SHORT[Number(key.slice(5, 7)) - 1],
      year: Number(key.slice(0, 4)),
      value,
      display: fmt(metric, value),
      previous,
      previousDisplay: previous === null ? null : fmt(metric, previous),
      changePct: previous ? round1((value / previous - 1) * 100) : null,
      partial: key === partialKey,
    }
  })
  const best = points.filter((p) => !p.partial && p.value > 0).reduce((top, p) => (!top || p.value > top.value ? p : top), null)
  const years = [...new Set(points.map((p) => p.year))]
  return {
    kind: 'months',
    format: METRICS[metric].format,
    points,
    best: best?.key ?? null,
    currentLabel: years.length === 1 ? String(years[0]) : 'This period',
    previousLabel: lastYear ? (years.length === 1 ? String(years[0] - 1) : 'Year before') : null,
  }
}

// The short line under the big number: only what the number doesn't say
// (best month, months that beat last year, the difference), never the
// number or the % again.
function summaryFor(recipe, result, chart) {
  if (chart) {
    const parts = []
    const best = chart.points.find((p) => p.key === chart.best)
    if (best) parts.push(`Best month: ${best.label} ${best.year} (${best.display}).`)
    const comparable = chart.points.filter((p) => !p.partial && p.previous > 0)
    if (comparable.length) {
      const vs = chart.previousLabel === 'Year before' ? 'the year before' : chart.previousLabel
      parts.push(`${comparable.filter((p) => p.value > p.previous).length} of ${comparable.length} months beat ${vs}.`)
    }
    const partial = chart.points.find((p) => p.partial)
    if (partial) parts.push(`${partial.label} ${partial.year} is to date.`)
    return parts.join(' ')
  }
  if (!recipe.groupBy && recipe.previousPeriod && result.previous?.value) {
    const diff = result.value - result.previous.value
    return `That's ${fmt(recipe.metric, Math.abs(diff))} ${diff >= 0 ? 'more' : 'less'} than ${recipe.previousPeriod.label}.`
  }
  return ''
}

// The filter chips under the question (metric, breakdown, period): each lists
// what it can be changed to; changing one re-runs the answer (POST
// /copilot/rerun). Only choices that make sense for the same records.
export function controlsFor(recipe, choices, { network = false } = {}) {
  const { fact } = METRICS[recipe.metric]
  const metricOptions = Object.entries(METRICS)
    .filter(([key, m]) => m.fact === fact && key !== 'orderUnits')
    .map(([key, m]) => ({ value: key, label: capitalize(m.label) }))
  const groupOptions = [
    { value: '', label: 'Total' },
    ...Object.entries(dimensionsFor(network))
      .filter(([key, d]) => d.facts.includes(fact) && !(fact === 'sales' && ['customer', 'customerType', 'city'].includes(key)))
      .map(([key, d]) => ({ value: key, label: `By ${d.label}` })),
  ]
  const same = (a, b) => a.from.getTime() === b.from.getTime() && a.to.getTime() === b.to.getTime()
  const current = choices.find((c) => same(c.period, recipe.period))
  const periodOptions = [
    ...(current ? [] : [{ value: 'current', label: capitalize(recipe.period.label), disabled: true }]),
    ...choices.map((c) => ({ value: c.value, label: capitalize(c.period.label) })),
  ]
  return [
    { key: 'metric', value: recipe.metric, options: metricOptions },
    { key: 'groupBy', value: recipe.groupBy ?? '', options: groupOptions },
    { key: 'period', value: current?.value ?? 'current', options: periodOptions },
  ]
}

// The rest of "how it was understood" (filters and the comparison), shown as
// plain chips after the filter chips.
function extraTags(recipe) {
  const tags = []
  const f = recipe.filters
  if (f.state) tags.push(capitalize(STATE_LABEL[f.state]))
  if (f.category) tags.push(CATEGORY_LABELS[f.category])
  if (f.sku) tags.push(f.sku)
  if (f.customerType) tags.push(capitalize(f.customerType))
  if (f.city) tags.push(f.city)
  if (f.customer) tags.push(f.customer)
  if (f.dealerName) tags.push(f.dealerName)
  if (recipe.previousPeriod) tags.push(`vs ${recipe.previousPeriod.label}`)
  return tags
}

// The comparison sentence added to the answer: " That's up 12.5% from $X in 2024."
function changeSentence(metric, current, previous, previousLabel) {
  if (!previous) return ` There was nothing to compare with in ${previousLabel}.`
  const change = current / previous - 1
  const direction = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat'
  return direction === 'flat'
    ? ` That's the same as ${previousLabel} (${fmt(metric, previous)}).`
    : ` That's ${direction} ${pct(change)} from ${fmt(metric, previous)} in ${previousLabel}.`
}

// The evidence lines: how many records the answer is based on, the exact dates,
// and the comparison period.
function evidenceFor(recipe, result, network) {
  const { fact } = METRICS[recipe.metric]
  const evidence = []
  if (fact === 'sales') evidence.push(`${number(result.recordCount)} sales to customers`)
  else evidence.push(`${number(result.recordCount)} ${fact === 'claims' ? 'claims' : fact}`)
  if (network && !recipe.filters.dealerId) evidence.push(`all ${plural(network.dealerCount, 'dealer')} in your network`)
  evidence.push(rangeLabel(recipe.period.from, recipe.period.to))
  if (recipe.previousPeriod) evidence.push(`compared with ${recipe.previousPeriod.label} (${number(result.previous.recordCount)} records)`)
  return evidence
}

// Up to 3 follow-up questions to click, e.g. "Compare with last year", "Show by month".
function suggestionsFor(recipe, network) {
  const { fact } = METRICS[recipe.metric]
  const options = []
  if (network && !recipe.groupBy && !recipe.filters.dealerId) options.push('Break down by dealer')
  if (!recipe.previousPeriod) options.push('Compare with last year')
  if (recipe.groupBy !== 'month') options.push('Show by month')
  if (!recipe.groupBy && DIMENSIONS.product.facts.includes(fact)) options.push('Break down by product')
  if (!recipe.groupBy && fact !== 'sales') options.push('Break down by status')
  if (fact === 'sales' && recipe.metric !== 'profit') options.push('What about profit?')
  return options.slice(0, 3)
}

// MAIN ANSWER for data questions (sales, profit, units, orders, claims...).
// Takes the recipe from the parser and the result from the engine and builds
// the full reply: sentence, big number, chart (months), table (breakdowns),
// evidence, tags, button and follow-up suggestions.
// network: { dealerCount } on the manufacturer's Copilot (all its dealers),
// so the wording is about the dealers ("Your dealers sold ..."), not "you".
export function queryAnswer(recipe, result, network = null) {
  const { metric, filters, period } = recipe
  const label = METRICS[metric].label
  const { fact } = METRICS[metric]
  const words = filterWords(filters)
  const subject = `${words ? `${words} ` : ''}${label}${filterSuffix(filters)}`
  // Who did it: "You" (dealer), "Your dealers" or the one dealer asked about.
  const who = network ? (filters.dealerName ?? 'Your dealers') : 'You'
  const whose = network ? (filters.dealerName ? `${filters.dealerName}'s` : 'Your network\'s') : 'Your'
  const own = `${words ? `${words} ` : ''}${label}${filterSuffix(filters, { dealer: false })}`
  let text

  if (result.unsupportedGroup) {
    text = `Revenue isn't recorded by customer, so I can't show ${subject} by ${DIMENSIONS[recipe.groupBy].label}. Try "top products by revenue last year".`
  } else if (recipe.groupBy && result.groups?.length) {
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
    text = `${who} sold ${number(result.value)} ${what}${type}${filterSuffix(filters, { dealer: false })} ${periodPhrase(period)}.`
  } else if (metric === 'registrationCount') {
    text = `${who} installed and registered ${plural(result.value, 'unit')}${words ? ` (${words})` : ''}${filterSuffix(filters, { dealer: false })} ${periodPhrase(period)}.`
  } else if (metric === 'orderUnits') {
    text = `${whose} ${own} ${periodPhrase(period)}: ${number(result.value)} units.`
  } else if (METRICS[metric].value) {
    text = `${whose} ${own} ${periodPhrase(period)} ${label.endsWith('s') ? 'were' : 'was'} ${fmt(metric, result.value)}.`
  } else {
    const verb = period.kind === 'all' || filters.state === 'pending' ? 'have' : 'had'
    const noun = `${words ? `${words} ` : ''}${singularize(label, result.value)}${filterSuffix(filters, { dealer: false })}`
    text = `${who} ${verb === 'have' && who !== 'You' && filters.dealerName ? 'has' : verb} ${number(result.value)} ${noun} ${periodPhrase(period)}.`
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
  // Months are shown as a bar chart (with last year's months next to them).
  const chart = grouped && recipe.groupBy === 'month' ? monthChart(recipe, result) : null
  const highlight = !grouped || recipe.groupBy === 'month' ? highlightFor(recipe, result, chart) : null
  const evidence = evidenceFor(recipe, result, network)

  return {
    text,
    // With a big number, the card shows this instead of `text` (which stays
    // complete for copying and screen readers).
    summary: highlight ? summaryFor(recipe, result, chart) : null,
    highlight,
    chart,
    table,
    evidence,
    // The first evidence item ("N sales to customers") opens these records.
    records: { count: result.recordCount, label: evidence[0] },
    understood: describeRecipe(recipe),
    tags: recipeTags(recipe),
    extraTags: extraTags(recipe),
    actions: network ? (NETWORK_ACTION[fact] ? [NETWORK_ACTION[fact]] : []) : [FACT_ACTION[fact]],
    suggestions: suggestionsFor(recipe, network),
  }
}

// ---------------------------------------------------------------------------
// Special answers (reuse the existing in-house models)
// ---------------------------------------------------------------------------

// "What is my health score?": the score out of 100, the strongest and weakest
// part, and a table of the 4 parts (same data as the Dealer 360 screen).
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
    suggestions: ['Compare my revenue with last year', 'How many claims are pending?', 'Show revenue by month'],
  }
}

// "What should I stock next month?": which products may run short in the next
// 30 days (expected sales vs stock on hand + on order).
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
    actions: [{ label: 'Reorder now', module: MODULES.ORDERS, action: 'createOrder' }], // opens the new order form
    suggestions: ['Which products sold the most last month?', 'Show furnace revenue by month', 'What is my health score?'],
  }
}

// "Which incentive am I closest to?": progress in each incentive program and
// the next milestone payout. (Incentives module is hidden from the menu now.)
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
    evidence: ['Progress is calculated from your sales to customers and completed training'],
    understood: 'Incentive programs',
    tags: ['Incentive programs'],
    highlight: closest ? { value: `${closest.percentToNext}%`, caption: `to the next "${closest.name}" milestone` } : null,
    actions: [], // the Incentives screen is no longer in the app
    suggestions: ['How many heat pumps did I sell this year?', 'Show my revenue by month', 'What is my health score?'],
  }
}

// One example question per topic, shown as clickable suggestions.
const EXAMPLES = {
  revenue: 'What was my total revenue last year?',
  profit: 'Which products generated the highest profit?',
  units: 'How many units did I sell this year?',
  orders: 'How many orders are pending?',
  claims: 'How many claims are pending?',
  health: 'What is my health score?',
  forecast: 'What should I stock next month?',
}
// The module each example belongs to, so users only see examples they have access to.
const EXAMPLE_MODULE = {
  revenue: MODULES.DEALER_360,
  profit: MODULES.DEALER_360,
  units: MODULES.DEALER_360,
  orders: MODULES.ORDERS,
  claims: MODULES.WARRANTY,
  health: MODULES.DEALER_360,
  forecast: MODULES.INVENTORY,
}

// Example questions the user is allowed to ask (filtered by their permissions).
export function examplesFor(can, intents = Object.keys(EXAMPLES)) {
  return intents.filter((i) => EXAMPLES[i] && can(EXAMPLE_MODULE[i])).map((i) => EXAMPLES[i])
}

// "hi" / "help" / "what can you do": a welcome message with example questions.
export function greetingAnswer(can) {
  return {
    text: "Hi! I'm your Dealer Copilot. Ask me about your revenue, profit, orders, warranty claims, stock and prices, in your own words. Every answer comes from your dealership's own data, with the evidence shown.",
    evidence: [],
    actions: [],
    suggestions: examplesFor(can).slice(0, 4),
  }
}

// When the Copilot is not sure (e.g. sales or profit?): asks back with the
// closest example questions instead of guessing.
export function clarifyAnswer(can, options) {
  const suggestions = examplesFor(can, options)
  return {
    text: suggestions.length
      ? "I'm not completely sure what you mean. Did you mean one of these?"
      : "I'm not sure what you mean. Try asking about revenue, orders, claims or stock.",
    evidence: [],
    actions: [],
    suggestions: suggestions.length ? suggestions : examplesFor(can).slice(0, 3),
  }
}

// Question not about the dealer's data (e.g. "weather"): says what it can
// answer instead of guessing.
export function unknownAnswer(can) {
  return {
    text: "I can only answer questions about your dealership's data: revenue, profit, orders, warranty claims, installs, stock, prices and your Health Score. I won't guess about anything else.",
    evidence: [],
    actions: [],
    suggestions: examplesFor(can).slice(0, 3),
  }
}

// The user's account cannot open the module this data comes from.
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

// plural(1, "user") -> "1 user", plural(5, "user") -> "5 users"
const plural = (n, word) => `${number(n)} ${n === 1 ? word : `${word}s`}`

// The app shows two account types only: Dealer and Manufacturer (project
// decision). The finer dealer roles stay in the database for access rules.
const MANUFACTURER_ROLE = 'manufacturer'
const accountType = (roleId) => (roleId === MANUFACTURER_ROLE ? 'Manufacturer' : 'Dealer')

// "How many users are there?": number of user accounts at the dealership.
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
    suggestions: ['What is my health score?', 'How many orders are pending?', 'Compare my revenue with last year'],
  }
}

// "How many dealers are in the network?": dealers of the same manufacturer.
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
    suggestions: ownDealerId
      ? ['What is my health score?', 'Compare my revenue with last year', 'How many claims are pending?']
      : ['Top dealers by revenue this year', 'How are my dealers\' health scores?', 'Which dealer has the most warranty claims?'],
  }
}

// "What is my territory coverage?": % of the assigned territory the dealer serves.
// dealer: { name, region, territoryCoverage (0..1) }. The dealer's own value
// only (the same as the Dealer 360 tile), never other dealers' figures.
export function territoryAnswer(dealer) {
  const pct = Math.round(dealer.territoryCoverage * 100)
  return {
    text: `Your territory coverage is ${pct}%: ${dealer.name} serves ${pct}% of the territory assigned to it by the manufacturer in ${dealer.region}. The other ${100 - pct}% is room to grow.`,
    highlight: { value: `${pct}%`, caption: 'Territory coverage' },
    evidence: ['Territory coverage stored on your dealer record (assigned by the manufacturer)'],
    tags: ['Territory coverage'],
    understood: 'Territory coverage',
    actions: [{ label: 'Open Dealer 360', module: MODULES.DEALER_360 }],
    suggestions: ['What is my health score?', 'Compare my revenue with last year', 'How many dealers are in the network?'],
  }
}

// stats: { total, residential, commercial, activeThisYear, year }
// "How many customers do I have?": total, residential vs commercial, and how
// many bought this year.
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
    suggestions: ['Compare my revenue with last year', 'How many orders are pending?', 'What is my health score?'],
  }
}

// roles: [{ id, name, permissions: [module] }], counts: { roleId: users at this dealership }
// Screen names shown in the account types table.
const MODULE_NAMES = {
  home: 'Home',
  dealer360: 'Dealer 360',
  orders: 'Orders',
  inventory: 'Inventory',
  warranty: 'Warranty & Claims',
  orderApprovals: 'Order Approvals',
}

// "What roles are there?": the 2 account types (Dealer, Manufacturer), how many
// users each has here, and which screens each can open.
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

// "How much data do we have?": first and latest order date and record counts.
// stats: { from, to, orders, quotes, claims, customers, joined }
export function coverageAnswer(stats) {
  const months = (stats.to.getUTCFullYear() - stats.from.getUTCFullYear()) * 12 + (stats.to.getUTCMonth() - stats.from.getUTCMonth()) + stats.to.getUTCDate() / 31
  const years = Math.round((months / 12) * 10) / 10
  const span = years >= 1 ? `${years} ${years === 1 ? 'year' : 'years'}` : `${Math.round(months)} months`
  const fmtDay = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  return {
    text: `You have about ${span} of data, from ${fmtDay(stats.from)} to ${fmtDay(stats.to)}${stats.joined ? ' (since your dealership joined the network)' : ''}. It covers ${plural(stats.orders, 'order')} and ${plural(stats.claims, 'warranty claim')}.`,
    highlight: { value: span, caption: `of data · ${fmtDay(stats.from)} – ${fmtDay(stats.to)}` },
    table: {
      columns: ['Data', 'Records'],
      rows: [['Orders', number(stats.orders)], ['Warranty claims', number(stats.claims)]],
    },
    evidence: ['First and latest order dates in your data'],
    tags: ['Data coverage'],
    understood: 'Data coverage',
    actions: [],
    suggestions: ['Show revenue by month', 'Compare my revenue with last year', 'What was my total revenue last year?'],
  }
}


// ---------------------------------------------------------------------------
// Manufacturer Copilot (the whole dealer network)
// ---------------------------------------------------------------------------

// Example questions for the manufacturer.
export const NETWORK_EXAMPLES = [
  'Top dealers by revenue this year',
  'Compare network revenue with last year',
  'Which dealer has the most warranty claims?',
  "How are my dealers' health scores?",
  'How many orders are pending?',
  'Show revenue by month',
]

export function networkGreetingAnswer(manufacturerName) {
  return {
    text: `Hi! I'm your Network Copilot for ${manufacturerName}. Ask me about your dealers' revenue, profit, orders, warranty claims, installs and Health Scores, for the whole network or one dealer, in your own words. Every answer comes from your dealers' data, with the evidence shown.`,
    evidence: [],
    actions: [],
    suggestions: NETWORK_EXAMPLES.slice(0, 4),
  }
}

export function networkUnknownAnswer() {
  return {
    text: "I can only answer questions about your dealer network's data: revenue, profit, orders, quotes, warranty claims, installs and Health Scores, for all dealers or one dealer. I won't guess about anything else.",
    evidence: [],
    actions: [],
    suggestions: NETWORK_EXAMPLES.slice(0, 3),
  }
}

export function networkClarifyAnswer() {
  return {
    text: "I'm not completely sure what you mean. Did you mean one of these?",
    evidence: [],
    actions: [],
    suggestions: NETWORK_EXAMPLES.slice(0, 3),
  }
}

// Topics kept by each dealer for itself (stock, incentives, Sales Coach, ...).
export function dealerOnlyAnswer(what) {
  return {
    text: `${capitalize(what)} is managed by each dealer in its own app, so I can't answer that for the network. I can tell you about your dealers' revenue, orders, warranty claims and Health Scores.`,
    evidence: [],
    actions: [],
    suggestions: NETWORK_EXAMPLES.slice(0, 3),
  }
}

// "How are my dealers' health scores?": every dealer's score, best first.
// rows: [{ name, region, score (0..100 or null), weakest: { label, score } | null }]
export function networkHealthAnswer(rows) {
  const scored = rows.filter((r) => r.score !== null).sort((a, b) => b.score - a.score)
  if (!scored.length) return { text: 'There is not enough data yet to calculate your dealers\' Health Scores.', evidence: [], actions: [], suggestions: [] }
  const average = Math.round(scored.reduce((sum, r) => sum + r.score, 0) / scored.length)
  const best = scored[0]
  const lowest = scored.at(-1)
  const below = scored.filter((r) => r.score < 60)
  return {
    text: `Your dealers' average Health Score is ${average} out of 100. Highest: ${best.name} (${best.score}). Lowest: ${lowest.name} (${lowest.score})${lowest.weakest ? `, weakest on ${lowest.weakest.label.toLowerCase()} (${lowest.weakest.score})` : ''}.${below.length ? ` ${plural(below.length, 'dealer')} ${below.length === 1 ? 'is' : 'are'} below 60.` : ''}`,
    highlight: { value: `${average} / 100`, caption: `Average Health Score · ${plural(scored.length, 'dealer')}` },
    summary: `Highest: ${best.name} (${best.score}). Lowest: ${lowest.name} (${lowest.score}).`,
    table: {
      columns: ['Dealer', 'Region', 'Score', 'Weakest area'],
      rows: [...scored, ...rows.filter((r) => r.score === null)].map((r) => [r.name, r.region, r.score ?? '-', r.weakest ? `${r.weakest.label} (${r.weakest.score})` : '-']),
    },
    evidence: ['Each dealer\'s Health Score: revenue growth, order velocity, warranty compliance and training completion'],
    understood: 'Health Score · all dealers',
    tags: ['Health Score', 'all dealers', 'today'],
    actions: [],
    suggestions: ['Top dealers by revenue this year', 'Which dealer has the most warranty claims?', 'Compare network revenue with last year'],
  }
}
