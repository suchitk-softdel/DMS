//train the AI ONCE WHEN SERCIE START
// . Small helper functions fetch the data for the special answers:

// coverageFor (data range)
// rolesFor
// teamFor
// networkFor
// customersFor
// trainingFor

import { MODULES } from '../constants/domain.js'
import {
  clarifyAnswer,
  controlsFor,
  coverageAnswer,
  territoryAnswer,
  customersAnswer,
  dealerOnlyAnswer,
  forecastAnswer,
  greetingAnswer,
  healthAnswer,
  incentivesAnswer,
  networkAnswer,
  networkClarifyAnswer,
  networkGreetingAnswer,
  networkHealthAnswer,
  networkUnknownAnswer,
  noAccessAnswer,
  queryAnswer,
  rolesAnswer,
  teamAnswer,
  unknownAnswer,
} from '../copilot/answers.js'
import { train } from '../copilot/classifier.js'
import { recordsFor, runRecipe } from '../copilot/engine.js'
import { opportunitiesAnswer, priceAnswer, stockAnswer, trainingAnswer } from '../copilot/infoAnswers.js'
import { parseQuestion, SPECIAL_KEYWORDS } from '../copilot/parser.js'
import { periodChoices, previousYear } from '../copilot/period.js'
import { tokenize } from '../copilot/text.js'
import { TRAINING_DATA } from '../copilot/trainingData.js'
import {
  CATEGORY_WORDS,
  COMPARE_WORDS,
  CUSTOMER_TYPE_WORDS,
  DIMENSIONS,
  FACT_MODULE,
  LOWEST_WORDS,
  METRICS,
  RANKING_WORDS,
  STATE_WORDS,
  STOP_WORDS,
  dimensionsFor,
} from '../copilot/vocabulary.js'
import { prisma } from '../db/prisma.js'
import { logAudit } from './auditLog.js'
import { forecastDemand } from './forecastService.js'
import { computeHealthScore } from './healthScoreService.js'
import { listIncentives } from './incentiveService.js'
import { listInventory } from './inventoryService.js'
import { listOpportunities } from './opportunityService.js'
import { getTrainingOverview } from './trainingService.js'

// Dealer Copilot (SRS 3.2), and the same Copilot for the manufacturer over its
// whole dealer network. Built in-house: a trained Naive Bayes classifier
// plus a business dictionary turn the question into a recipe, one generic
// engine runs it on the dealer's own data, and every answer carries its
// evidence. No third-party AI service, API key or AI library is used.

// Trained once when the server starts (takes a few milliseconds).
const model = train(TRAINING_DATA)

// Every word the Copilot knows, used for spelling correction.
const DICTIONARY_WORDS = new Set([
  ...model.vocabulary,
  ...STOP_WORDS,
  ...[
    ...Object.values(METRICS).flatMap((m) => m.words),
    ...Object.values(DIMENSIONS).flatMap((d) => d.words),
    ...Object.values(CATEGORY_WORDS).flat(),
    ...Object.values(STATE_WORDS).flatMap((s) => s.words),
    ...Object.values(CUSTOMER_TYPE_WORDS).flat(),
    ...RANKING_WORDS,
    ...LOWEST_WORDS,
    ...COMPARE_WORDS,
    ...Object.values(SPECIAL_KEYWORDS).flat(),
    'database', 'system', 'app', 'application',
    'customer', 'customers', 'clients',
    // follow-up words
    'before', 'earlier', 'prior', 'instead', 'again', 'same', 'only', 'just', 'also', 'now', 'then', 'break', 'down',
    'split', 'per', 'each', 'wise', 'across', 'versus', 'year', 'years', 'q1', 'q2', 'q3', 'q4', 'ytd', 'mtd',
    'health', 'score', 'forecast', 'stock', 'reorder', 'inventory', 'incentive', 'incentives', 'rebate', 'bonus',
    'milestone', 'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october',
    'november', 'december', 'quarter', 'financial', 'fiscal', 'compare', 'breakdown',
  ].flatMap(tokenize),
])

// Values from the database, so new products, cities and customers are
// understood without a code change.
async function loadLexicon(scope) {
  // All city names are recognised (not only this dealer's), so "sales in
  // Tampa" for a Denver dealer correctly answers $0 instead of ignoring Tampa.
  // Only names are read here; figures always come from the dealer's own data.
  const [products, customers, cityRows] = await Promise.all([
    prisma.product.findMany({ select: { sku: true } }),
    prisma.customer.findMany({ where: { dealerId: scope.dealers }, select: { name: true, city: true } }),
    prisma.customer.findMany({ distinct: ['city'], select: { city: true } }),
  ])
  const skus = products.map((p) => p.sku)
  const cities = cityRows.map((c) => c.city)
  const customerNames = [...new Set(customers.map((c) => c.name))]
  const dealers = scope.network ? dealerAliases(scope.network.list) : []
  const dealerWords = dealers.flatMap((d) => d.aliases)
  const knownWords = new Set([...DICTIONARY_WORDS, ...[...cities, ...customerNames, ...skus, ...dealerWords].flatMap(tokenize)])
  return { skus, cities, customers: customerNames, dealers, knownWords }
}

// Names a dealer can be asked about by: the full name, its first two words
// ("Lone Star") and its first word when long enough ("Summit"), each only
// when no other dealer shares it. Lower case, as the question is matched.
function dealerAliases(list) {
  const candidates = list.map((d) => {
    const words = d.name.toLowerCase().replace(/[^a-z0-9& ]/g, ' ').split(/\s+/).filter(Boolean)
    return { id: d.id, name: d.name, all: [d.name.toLowerCase(), words.slice(0, 2).join(' '), words[0].length >= 5 ? words[0] : null].filter(Boolean) }
  })
  const count = new Map()
  for (const c of candidates) for (const alias of new Set(c.all)) count.set(alias, (count.get(alias) ?? 0) + 1)
  return candidates.map((c) => ({ id: c.id, name: c.name, aliases: [...new Set(c.all)].filter((a) => count.get(a) === 1) }))
}

// Whose data the Copilot answers from:
//   a dealer user        -> its own dealership: { dealers: 'd-1001', network: null }
//   a manufacturer user  -> every dealer in its network:
//                           { dealers: { in: [ids] }, network: { dealerCount, list, manufacturerId } }
async function scopeFor(user) {
  if (user.dealerId) return { dealers: user.dealerId, network: null }
  const list = await prisma.dealer.findMany({
    where: { manufacturerId: user.manufacturerId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, region: true },
  })
  return { dealers: { in: list.map((d) => d.id) }, network: { dealerCount: list.length, list, manufacturerId: user.manufacturerId } }
}

// The manufacturer sees all of its dealers' figures; a dealer user needs the
// module the data comes from (SRS 6.2).
const canSeeFact = (user, scope, fact) => Boolean(scope.network) || user.permissions.includes(FACT_MODULE[fact])

// The previous answer's recipe, sent back by the client for follow-up
// questions. Only known values are accepted.
function reviveContext(context) {
  const recipe = context?.recipe
  if (!recipe || !METRICS[recipe.metric]) return null
  const date = (value) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const period = recipe.period && { ...recipe.period, from: date(recipe.period.from), to: date(recipe.period.to) }
  if (!period?.from || !period?.to) return null
  const revived = {
    metric: recipe.metric,
    groupBy: DIMENSIONS[recipe.groupBy] ? recipe.groupBy : null,
    filters: typeof recipe.filters === 'object' && recipe.filters
      ? Object.fromEntries(Object.entries(recipe.filters).filter(([, v]) => typeof v === 'string'))
      : {},
    period: { from: period.from, to: period.to, label: String(period.label ?? ''), kind: String(period.kind ?? '') },
    compare: recipe.compare === true,
    sort: recipe.sort === 'asc' ? 'asc' : 'desc',
    limit: Number.isInteger(recipe.limit) && recipe.limit > 0 && recipe.limit <= 15 ? recipe.limit : 15,
    singular: recipe.singular === true,
  }
  revived.previousPeriod = revived.compare ? previousYear(revived.period) : null
  return { recipe: revived }
}

// A data answer for a recipe, with its filter chips and the context the
// client sends back (follow-ups, filter changes, opening the records).
async function recipeAnswer(scope, recipe, now) {
  // A dealer user can never break its own data down "by dealer".
  if (!scope.network && recipe.groupBy === 'dealer') recipe = { ...recipe, groupBy: null }
  const answer = queryAnswer(recipe, await runRecipe(scope.dealers, recipe), scope.network)
  return { answer: { ...answer, controls: controlsFor(recipe, periodChoices(now), { network: Boolean(scope.network) }) }, context: { recipe } }
}

async function trainingFor(user) {
  const [overview, assigned, completed] = await Promise.all([
    getTrainingOverview(user.id),
    prisma.trainingProgress.count({ where: { user: { dealerId: user.dealerId } } }),
    prisma.trainingProgress.count({ where: { user: { dealerId: user.dealerId }, completedAt: { not: null } } }),
  ])
  return trainingAnswer(overview, { assigned, completed })
}

async function coverageFor(dealerId) {
  const [range, network, orders, quotes, claims, customers, dealer] = await Promise.all([
    prisma.order.aggregate({ where: { dealerId }, _min: { createdAt: true }, _max: { createdAt: true } }),
    prisma.order.aggregate({ _min: { createdAt: true } }),
    prisma.order.count({ where: { dealerId, type: 'order' } }),
    prisma.order.count({ where: { dealerId, type: 'quote' } }),
    prisma.claim.count({ where: { dealerId } }),
    prisma.customer.count({ where: { dealerId } }),
    prisma.dealer.findUnique({ where: { id: dealerId }, select: { createdAt: true } }),
  ])
  const from = range._min.createdAt
  return coverageAnswer({
    from,
    to: range._max.createdAt,
    orders,
    quotes,
    claims,
    customers,
    // The dealer joined well after the network's data starts (e.g. a new dealer).
    joined: dealer.createdAt.getTime() > network._min.createdAt.getTime() + 31 * 24 * 60 * 60 * 1000,
  })
}

async function rolesFor(user) {
  const [roles, users] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.groupBy({ by: ['roleId'], where: { dealerId: user.dealerId }, _count: { _all: true } }),
  ])
  const counts = Object.fromEntries(users.map((u) => [u.roleId, u._count._all]))
  return rolesAnswer(
    roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) })),
    counts,
    user.roleId,
  )
}

async function teamFor(dealerId) {
  const [dealer, users] = await Promise.all([
    prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true } }),
    prisma.user.findMany({ where: { dealerId }, select: { roleId: true } }),
  ])
  return teamAnswer(dealer.name, users)
}

async function networkFor(dealerId) {
  const own = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { manufacturerId: true } })
  const [manufacturer, dealers] = await Promise.all([
    prisma.manufacturer.findUnique({ where: { id: own.manufacturerId }, select: { name: true, headquarters: true } }),
    prisma.dealer.findMany({
      where: { manufacturerId: own.manufacturerId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, region: true, tier: true, status: true },
    }),
  ])
  return networkAnswer(manufacturer, dealers, dealerId)
}

async function customersFor(dealerId, now) {
  const year = now.getUTCFullYear()
  const [residential, commercial, active] = await Promise.all([
    prisma.customer.count({ where: { dealerId, type: 'residential' } }),
    prisma.customer.count({ where: { dealerId, type: 'commercial' } }),
    prisma.customer.count({
      where: {
        dealerId,
        orders: { some: { type: 'order', status: 'fulfilled', createdAt: { gte: new Date(Date.UTC(year, 0, 1)), lte: now } } },
      },
    }),
  ])
  return customersAnswer({ total: residential + commercial, residential, commercial, activeThisYear: active, year })
}

// "How many dealers": the manufacturer's dealer list.
async function manufacturerNetwork(scope) {
  const [manufacturer, dealers] = await Promise.all([
    prisma.manufacturer.findUnique({ where: { id: scope.network.manufacturerId }, select: { name: true, headquarters: true } }),
    prisma.dealer.findMany({
      where: { manufacturerId: scope.network.manufacturerId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, region: true, tier: true, status: true },
    }),
  ])
  return networkAnswer(manufacturer, dealers, null)
}

// Every dealer's Health Score (the same model as Dealer 360).
async function networkHealth(scope, now) {
  const rows = await Promise.all(
    scope.network.list.map(async (dealer) => {
      const health = await computeHealthScore(dealer.id, now)
      const weakest = health.components.filter((c) => c.score !== null).sort((a, b) => a.score - b.score)[0] ?? null
      return { name: dealer.name, region: dealer.region, score: health.score, weakest: weakest && { label: weakest.label, score: weakest.score } }
    }),
  )
  return networkHealthAnswer(rows)
}

// Special topics on the manufacturer's Copilot: the network's dealers and
// their Health Scores; the rest belongs to each dealer.
const DEALER_ONLY_TOPIC = {
  forecast: 'stock and forecasting',
  stock: 'stock',
  incentives: 'incentives',
  training: 'training',
  opportunities: 'the Sales Coach pipeline',
  territory: 'territory coverage',
  customers: 'the customer list',
  coverage: 'data history',
  team: 'user accounts',
}
async function networkSpecial(parsed, user, scope, now) {
  if (parsed.intent === 'health') return networkHealth(scope, now)
  if (parsed.intent === 'network') return manufacturerNetwork(scope)
  if (parsed.intent === 'price') return priceAnswer(await prisma.product.findMany(), parsed.filters ?? {}, parsed.wants)
  if (parsed.intent === 'roles') return rolesFor(user)
  if (DEALER_ONLY_TOPIC[parsed.intent]) return dealerOnlyAnswer(DEALER_ONLY_TOPIC[parsed.intent])
  const manufacturer = await prisma.manufacturer.findUnique({ where: { id: scope.network.manufacturerId }, select: { name: true } })
  return networkGreetingAnswer(manufacturer?.name ?? 'your network')
}

const SPECIAL_MODULE = {
  health: [MODULES.DEALER_360, 'your Health Score'],
  territory: [MODULES.DEALER_360, 'territory coverage'],
  forecast: [MODULES.INVENTORY, 'inventory and forecasts'],
  incentives: [MODULES.INCENTIVES, 'incentives'],
  customers: [MODULES.ORDERS, 'the customer list'],
  stock: [MODULES.INVENTORY, 'inventory'],
  training: [MODULES.INCENTIVES, 'training'],
  opportunities: [MODULES.SALES_COACH, 'the Sales Coach'],
}
const FACT_NAME = { sales: 'sales and profit figures', orders: 'orders', quotes: 'quotes', claims: 'warranty claims', registrations: 'warranty registrations' }

// user: req.user ({ id, dealerId | manufacturerId, permissions }). A dealer
// user asks about its own dealership; a manufacturer user about all of its
// dealers (the network Copilot).
// -> { text, table?, evidence, understood?, actions, suggestions, corrections, context? }
export async function askCopilot(user, question, rawContext, now = new Date()) {
  const can = (module) => user.permissions.includes(module)
  const scope = await scopeFor(user)
  const lexicon = await loadLexicon(scope)
  const parsed = parseQuestion(question, { model, lexicon, today: now, context: reviveContext(rawContext), network: Boolean(scope.network) })
  let answer
  let context = null

  if (scope.network && parsed.kind === 'special') {
    answer = await networkSpecial(parsed, user, scope, now)
  } else if (scope.network && parsed.kind === 'clarify') {
    answer = networkClarifyAnswer()
  } else if (scope.network && parsed.kind === 'unknown') {
    answer = networkUnknownAnswer()
  } else if (parsed.kind === 'special') {
    const [module, what] = SPECIAL_MODULE[parsed.intent] ?? []
    if (module && !can(module)) answer = noAccessAnswer(what)
    else if (parsed.intent === 'health') answer = healthAnswer(await computeHealthScore(user.dealerId, now))
    else if (parsed.intent === 'forecast') answer = forecastAnswer(await forecastDemand(user.dealerId, now))
    else if (parsed.intent === 'incentives') answer = incentivesAnswer(await listIncentives(user.dealerId))
    else if (parsed.intent === 'coverage') answer = await coverageFor(user.dealerId)
    else if (parsed.intent === 'territory') answer = territoryAnswer(await prisma.dealer.findUnique({ where: { id: user.dealerId }, select: { name: true, region: true, territoryCoverage: true } }))
    else if (parsed.intent === 'stock') answer = stockAnswer(await listInventory(user.dealerId), parsed.filters ?? {})
    else if (parsed.intent === 'price') answer = priceAnswer(await prisma.product.findMany(), parsed.filters ?? {}, parsed.wants)
    else if (parsed.intent === 'training') answer = await trainingFor(user)
    else if (parsed.intent === 'opportunities') answer = opportunitiesAnswer(await listOpportunities(user.dealerId, {}), now)
    else if (parsed.intent === 'roles') answer = await rolesFor(user)
    else if (parsed.intent === 'team') answer = await teamFor(user.dealerId)
    else if (parsed.intent === 'network') answer = await networkFor(user.dealerId)
    else if (parsed.intent === 'customers') answer = await customersFor(user.dealerId, now)
    else answer = greetingAnswer(can)
  } else if (parsed.kind === 'query') {
    const { fact } = METRICS[parsed.recipe.metric]
    if (!canSeeFact(user, scope, fact)) {
      answer = noAccessAnswer(FACT_NAME[fact])
    } else {
      ;({ answer, context } = await recipeAnswer(scope, parsed.recipe, now))
    }
  } else if (parsed.kind === 'clarify') {
    answer = clarifyAnswer(can, parsed.options)
  } else {
    answer = unknownAnswer(can)
  }

  // The question text is not stored (it may contain customer names, SRS 6.6).
  await logAudit({ userId: user.id, action: 'copilot.ask', details: { kind: parsed.kind, understood: answer.understood ?? null } })
  return { ...answer, corrections: parsed.corrections ?? [], context }
}

// Changing a filter chip under an answer: the same question with another
// metric, breakdown or period. change: { metric? | groupBy? | period? }
// (period is a value from periodChoices). -> the new answer, or null when the
// context is not valid.
export async function rerunCopilot(user, rawContext, change, now = new Date()) {
  const base = reviveContext(rawContext)?.recipe
  if (!base) return null
  const recipe = { ...base }
  if (change.metric !== undefined) {
    if (!METRICS[change.metric] || METRICS[change.metric].fact !== METRICS[base.metric].fact) return null
    recipe.metric = change.metric
  }
  const scope = await scopeFor(user)
  if (change.groupBy !== undefined) {
    if (change.groupBy !== '' && !dimensionsFor(Boolean(scope.network))[change.groupBy]) return null
    recipe.groupBy = change.groupBy || null
    recipe.singular = false
  }
  if (change.period !== undefined) {
    const choice = periodChoices(now).find((c) => c.value === change.period)
    if (!choice) return null
    recipe.period = choice.period
    // "All time" has nothing a year earlier to compare with.
    recipe.compare = base.compare && choice.value !== 'all'
    recipe.previousPeriod = recipe.compare ? previousYear(recipe.period) : null
  }
  const { fact } = METRICS[recipe.metric]
  if (!canSeeFact(user, scope, fact)) return { ...noAccessAnswer(FACT_NAME[fact]), context: null }
  const { answer, context } = await recipeAnswer(scope, recipe, now)
  await logAudit({ userId: user.id, action: 'copilot.rerun', details: { understood: answer.understood ?? null } })
  return { ...answer, corrections: [], context }
}

// The records behind an answer ("Based on: N records"), newest first.
// -> { title, columns, rows, total } (at most RECORD_LIMIT rows), or null.
const RECORD_LIMIT = 500
const isoDay = (date) => date.toISOString().slice(0, 10)
const money2 = (v) => `$${(Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const RECORD_COLUMNS = {
  sales: { title: 'Sales to customers', columns: ['Date', 'Product', 'Units', 'Revenue', 'Profit'], row: (r) => [isoDay(r.date), r.sku, r.units, money2(r.revenue), money2(r.revenue - r.cost)] },
  orders: { title: 'Orders', columns: ['Date', 'Order', 'Status', 'Units', 'Total'], row: (r) => [isoDay(r.date), r.id, r.status, r.units, money2(r.total ?? 0)] },
  quotes: { title: 'Quotes', columns: ['Date', 'Quote', 'Status', 'Units', 'Total'], row: (r) => [isoDay(r.date), r.id, r.status, r.units, money2(r.total ?? 0)] },
  claims: { title: 'Warranty claims', columns: ['Date', 'Claim', 'Status', 'Product', 'Amount'], row: (r) => [isoDay(r.date), r.id, r.status, r.sku, money2(r.amount ?? 0)] },
  registrations: { title: 'Installed units', columns: ['Install date', 'Registration', 'Product'], row: (r) => [isoDay(r.date), r.id, r.sku] },
}

export async function copilotRecords(user, rawContext) {
  const recipe = reviveContext(rawContext)?.recipe
  if (!recipe) return null
  const { fact } = METRICS[recipe.metric]
  const scope = await scopeFor(user)
  if (!canSeeFact(user, scope, fact)) return null
  const records = (await recordsFor(scope.dealers, recipe)).sort((a, b) => b.date - a.date)
  const { title, columns, row } = RECORD_COLUMNS[fact]
  // The manufacturer's records are from several dealers: add who.
  const withDealer = Boolean(scope.network)
  return {
    title: `${title} · ${recipe.period.label}`,
    columns: withDealer ? [columns[0], 'Dealer', ...columns.slice(1)] : columns,
    rows: records.slice(0, RECORD_LIMIT).map((r) => {
      const cells = row(r)
      return withDealer ? [cells[0], r.dealer, ...cells.slice(1)] : cells
    }),
    total: records.length,
  }
}
