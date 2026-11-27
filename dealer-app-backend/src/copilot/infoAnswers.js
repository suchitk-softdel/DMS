// Copilot answers about the dealership's current state: stock on hand, list
// prices, training and sales opportunities. Each reads existing services and
// shows the evidence behind the answer (SRS FR-COP-3).

import { MODULES } from '../constants/domain.js'
import { stockStatus } from '../services/inventoryService.js'
import { CATEGORY_LABELS } from './vocabulary.js'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Rounded to cents first, so the same amounts summed in a different order
// (floating-point noise) always show the same dollar figure.
const money = (v) => `$${Math.round(Math.round(v * 100) / 100).toLocaleString('en-US')}`
const number = (v) => Math.round(v).toLocaleString('en-US')
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const fmtDay = (d) => `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const PLURALS = { opportunity: 'opportunities', 'open opportunity': 'open opportunities' }
const plural = (n, word) => `${number(n)} ${n === 1 ? word : (PLURALS[word] ?? `${word}s`)}`

// "furnaces", "FN-H96-80" or null
const filterLabel = (filters) =>
  filters.sku ? filters.sku : filters.category ? CATEGORY_LABELS[filters.category].toLowerCase() : null

// Singular form for "the cheapest furnace", "heat pump list prices".
const CATEGORY_SINGULAR = {
  airConditioner: 'air conditioner',
  heatPump: 'heat pump',
  furnace: 'furnace',
  airHandler: 'air handler',
  thermostat: 'thermostat',
  indoorAirQuality: 'indoor air quality product',
  parts: 'part',
}
const singularLabel = (filters) => (filters.sku ? filters.sku : filters.category ? CATEGORY_SINGULAR[filters.category] : null)

const matchesProduct = (filters) => (product) =>
  (!filters.sku || product.sku === filters.sku) && (!filters.category || product.category === filters.category)

// rows: inventory [{ onHand, onOrder, reorderPoint, product: { sku, name, category, unitPrice } }]. Stock is valued at the dealer price (unitPrice), as on the Inventory screen.
export function stockAnswer(rows, filters) {
  const what = filterLabel(filters)
  const items = rows.filter((r) => matchesProduct(filters)(r.product))
  const onHand = items.reduce((sum, r) => sum + r.onHand, 0)
  const onOrder = items.reduce((sum, r) => sum + r.onOrder, 0)
  const value = items.reduce((sum, r) => sum + r.onHand * r.product.unitPrice, 0)
  // Same rule as the Inventory and Place Orders screens (stockStatus): out = 0
  // on hand, low = on hand at or below the reorder point. Units on order don't
  // count until they are received.
  const out = items.filter((r) => stockStatus(r) === 'out')
  const low = items.filter((r) => stockStatus(r) === 'low')

  let text
  if (filters.sku && items[0]) {
    const r = items[0]
    text = `${r.product.sku} (${r.product.name}): ${number(r.onHand)} on hand and ${number(r.onOrder)} on order. Reorder point: ${number(r.reorderPoint)}.`
    const status = stockStatus(r)
    if (status === 'out') text += ' It is out of stock.'
    else if (status === 'low') text += ' It is low on stock (at or below its reorder point), so it should be reordered.'
  } else {
    // "26 furnaces in stock" / "276 units in stock"
    text = `You have ${number(onHand)} ${filters.category ? what : onHand === 1 ? 'unit' : 'units'} in stock, worth ${money(value)} at dealer price, with ${number(onOrder)} more on order.`
    const list = (rows) => `${rows.slice(0, 4).map((r) => r.product.sku).join(', ')}${rows.length > 4 ? ` and ${rows.length - 4} more` : ''}`
    if (out.length) text += ` ${plural(out.length, 'product')} ${out.length === 1 ? 'is' : 'are'} out of stock: ${list(out)}.`
    if (low.length) text += ` ${plural(low.length, 'product')} ${low.length === 1 ? 'is' : 'are'} low on stock (at or below the reorder point): ${list(low)}.`
    if (!out.length && !low.length) text += ' Every product is above its reorder point.'
  }

  // Lowest stock (on hand compared with the reorder point) first.
  const margin = (r) => r.onHand - r.reorderPoint
  const sorted = [...items].sort((a, b) => margin(a) - margin(b))
  return {
    text,
    highlight: { value: plural(onHand, 'unit'), caption: `in stock${what ? ` · ${what}` : ''} · ${money(value)} at dealer price` },
    table: {
      columns: ['Product', 'On hand', 'On order', 'Reorder point', 'Value at dealer price'],
      rows: sorted.slice(0, 20).map((r) => [r.product.sku, r.onHand, r.onOrder, r.reorderPoint, money(r.onHand * r.product.unitPrice)]),
    },
    evidence: [`Current stock of ${plural(items.length, 'product')}`, 'lowest stock first'],
    tags: ['Stock on hand', ...(what ? [what] : []), 'today'],
    understood: ['Stock on hand', what].filter(Boolean).join(' · '),
    actions: [{ label: 'Open Inventory', module: MODULES.INVENTORY }],
    suggestions: ['What should I stock next month?', 'How many furnaces did we sell this year?', 'Revenue by category this year'],
  }
}

// products: catalogue [{ sku, name, category, unitPrice }]. List prices only,
// never cost (margins are not shown to every role).
// wants: 'cheapest' | 'mostExpensive' | null
export function priceAnswer(products, filters, wants) {
  const what = filterLabel(filters)
  const items = products
    .filter(matchesProduct(filters))
    .sort((a, b) => (wants === 'mostExpensive' ? b.unitPrice - a.unitPrice : a.unitPrice - b.unitPrice))
  const label = (p) => `${p.sku} (${p.name})`

  let text
  if (!items.length) text = 'I could not find that product in the catalogue.'
  else if (filters.sku) text = `${label(items[0])} has a list price of ${money(items[0].unitPrice)}.`
  else if (wants === 'cheapest') text = `The cheapest ${singularLabel(filters) ?? 'product'} is ${label(items[0])} at ${money(items[0].unitPrice)}.`
  else if (wants === 'mostExpensive') text = `The most expensive ${singularLabel(filters) ?? 'product'} is ${label(items[0])} at ${money(items[0].unitPrice)}.`
  else {
    const [low, high] = [items[0], items[items.length - 1]]
    text = what
      ? `${capitalize(singularLabel(filters))} list prices range from ${money(low.unitPrice)} (${low.sku}) to ${money(high.unitPrice)} (${high.sku}).`
      : `Your catalogue has ${plural(items.length, 'product')}, with list prices from ${money(low.unitPrice)} (${low.sku}) to ${money(high.unitPrice)} (${high.sku}).`
  }

  return {
    text,
    highlight: items[0] && (filters.sku || wants) ? { value: money(items[0].unitPrice), caption: `list price · ${items[0].sku}` } : null,
    table: items.length > 1 ? { columns: ['Product', 'Name', 'List price'], rows: items.map((p) => [p.sku, p.name, money(p.unitPrice)]) } : null,
    evidence: ['Manufacturer list prices, before discounts'],
    tags: ['List prices', ...(what ? [what] : [])],
    understood: ['List prices', what].filter(Boolean).join(' · '),
    actions: [{ label: 'Create Order', module: MODULES.ORDERS }],
    suggestions: ['Which products generated the highest profit?', 'How many furnaces are in stock?', 'What is my average order value?'],
  }
}

// overview: getTrainingOverview(userId); team: { assigned, completed } across the dealership
export function trainingAnswer(overview, team) {
  const done = overview.courses.filter((c) => c.completionPct === 100)
  const inProgress = overview.courses.filter((c) => c.completionPct > 0 && c.completionPct < 100)
  const next = overview.upcomingEvents[0]
  const certs = overview.certifications.map((c) => c.name)

  let text = `You have completed ${number(done.length)} of ${number(overview.courses.length)} courses`
  text += inProgress.length ? ` and have ${plural(inProgress.length, 'course')} in progress.` : '.'
  text += certs.length ? ` Certifications: ${certs.join(', ')}.` : ' You have no certifications yet.'
  if (next) text += ` Next live event: "${next.title}" on ${fmtDay(next.scheduledAt)}.`
  if (team.assigned) {
    text += ` Across your team, ${number(team.completed)} of ${number(team.assigned)} assigned courses are done (${Math.round((team.completed / team.assigned) * 100)}%).`
  }

  return {
    text,
    highlight: { value: `${done.length} / ${overview.courses.length}`, caption: 'courses completed' },
    table: {
      columns: ['Course', 'Category', 'Hours', 'Your progress'],
      rows: [
        ...overview.courses.map((c) => [c.title, capitalize(c.category), c.durationHours, c.completionPct === 100 ? 'Completed' : `${c.completionPct}%`]),
        ...overview.upcomingEvents.map((c) => [c.title, capitalize(c.category), c.durationHours, `Live on ${fmtDay(c.scheduledAt)}`]),
      ],
    },
    evidence: ['Your course progress', 'team totals across all staff at your dealership'],
    tags: ['Training'],
    understood: 'Training',
    actions: [], // the Training screen is no longer in the app
    suggestions: ['What is my health score?', 'How many users are there?', 'Compare my revenue with last year'],
  }
}

const OPEN_STAGES = ['new', 'qualified', 'proposal', 'negotiation']
const STAGE_NAMES = { new: 'New', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' }

// rows: opportunities [{ stage, budget, competitor, decisionDate, title, customer: { name } }]
export function opportunitiesAnswer(rows, now) {
  const open = rows.filter((r) => OPEN_STAGES.includes(r.stage))
  const pipeline = open.reduce((sum, r) => sum + r.budget, 0)
  const won = rows.filter((r) => r.stage === 'won').length
  const lost = rows.filter((r) => r.stage === 'lost').length

  const competitors = new Map()
  for (const r of rows) if (r.competitor) competitors.set(r.competitor, (competitors.get(r.competitor) ?? 0) + 1)
  const [topCompetitor] = [...competitors.entries()].sort((a, b) => b[1] - a[1])
  const nextDecision = open.filter((r) => r.decisionDate >= now).sort((a, b) => a.decisionDate - b.decisionDate)[0]

  const byStage = Object.keys(STAGE_NAMES).map((stage) => {
    const items = rows.filter((r) => r.stage === stage)
    return { stage, count: items.length, value: items.reduce((sum, r) => sum + r.budget, 0) }
  })
  const openParts = byStage.filter((s) => OPEN_STAGES.includes(s.stage) && s.count > 0).map((s) => `${s.count} ${STAGE_NAMES[s.stage].toLowerCase()}`)

  let text = `You have ${plural(open.length, 'open opportunity')} worth ${money(pipeline)}${openParts.length ? `: ${openParts.join(', ')}` : ''}.`
  if (won + lost) text += ` Win rate: ${Math.round((won / (won + lost)) * 100)}% (${won} won, ${lost} lost).`
  if (topCompetitor) text += ` Most frequent competitor: ${topCompetitor[0]} (${plural(topCompetitor[1], 'deal')}).`
  if (nextDecision) text += ` Next decision: "${nextDecision.title}" for ${nextDecision.customer.name} on ${fmtDay(nextDecision.decisionDate)}.`

  return {
    text,
    highlight: { value: money(pipeline), caption: `open pipeline · ${plural(open.length, 'opportunity')}` },
    table: { columns: ['Stage', 'Opportunities', 'Value'], rows: byStage.map((s) => [STAGE_NAMES[s.stage], s.count, money(s.value)]) },
    evidence: [`${plural(rows.length, 'opportunity')} in your Sales Coach`],
    tags: ['Sales opportunities'],
    understood: 'Sales opportunities',
    actions: [], // the Sales Coach screen is no longer in the app
    suggestions: ['What is my average order value?', 'Compare my revenue with last year', 'What is my health score?'],
  }
}
