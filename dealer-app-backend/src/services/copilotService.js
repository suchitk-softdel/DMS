import { MODULES } from '../constants/domain.js'
import {
  clarifyAnswer,
  coverageAnswer,
  territoryAnswer,
  customersAnswer,
  forecastAnswer,
  greetingAnswer,
  healthAnswer,
  incentivesAnswer,
  networkAnswer,
  noAccessAnswer,
  queryAnswer,
  rolesAnswer,
  teamAnswer,
  unknownAnswer,
} from '../copilot/answers.js'
import { train } from '../copilot/classifier.js'
import { runRecipe } from '../copilot/engine.js'
import { opportunitiesAnswer, priceAnswer, stockAnswer, trainingAnswer } from '../copilot/infoAnswers.js'
import { parseQuestion, SPECIAL_KEYWORDS } from '../copilot/parser.js'
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
} from '../copilot/vocabulary.js'
import { prisma } from '../db/prisma.js'
import { logAudit } from './auditLog.js'
import { forecastDemand } from './forecastService.js'
import { computeHealthScore } from './healthScoreService.js'
import { listIncentives } from './incentiveService.js'
import { listInventory } from './inventoryService.js'
import { listOpportunities } from './opportunityService.js'
import { getTrainingOverview } from './trainingService.js'

// Dealer Copilot (SRS 3.2), built in-house: a trained Naive Bayes classifier
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
async function loadLexicon(dealerId) {
  // All city names are recognised (not only this dealer's), so "sales in
  // Tampa" for a Denver dealer correctly answers $0 instead of ignoring Tampa.
  // Only names are read here; figures always come from the dealer's own data.
  const [products, customers, cityRows] = await Promise.all([
    prisma.product.findMany({ select: { sku: true } }),
    prisma.customer.findMany({ where: { dealerId }, select: { name: true, city: true } }),
    prisma.customer.findMany({ distinct: ['city'], select: { city: true } }),
  ])
  const skus = products.map((p) => p.sku)
  const cities = cityRows.map((c) => c.city)
  const customerNames = [...new Set(customers.map((c) => c.name))]
  const knownWords = new Set([...DICTIONARY_WORDS, ...[...cities, ...customerNames, ...skus].flatMap(tokenize)])
  return { skus, cities, customers: customerNames, knownWords }
}

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
  return {
    recipe: {
      metric: recipe.metric,
      groupBy: DIMENSIONS[recipe.groupBy] ? recipe.groupBy : null,
      filters: typeof recipe.filters === 'object' && recipe.filters ? recipe.filters : {},
      period: { from: period.from, to: period.to, label: String(period.label ?? ''), kind: String(period.kind ?? '') },
    },
  }
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

// user: req.user ({ id, dealerId, permissions }).
// -> { text, table?, evidence, understood?, actions, suggestions, corrections, context? }
export async function askCopilot(user, question, rawContext, now = new Date()) {
  const can = (module) => user.permissions.includes(module)
  const lexicon = await loadLexicon(user.dealerId)
  const parsed = parseQuestion(question, { model, lexicon, today: now, context: reviveContext(rawContext) })
  let answer
  let context = null

  if (parsed.kind === 'special') {
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
    if (!can(FACT_MODULE[fact])) {
      answer = noAccessAnswer(FACT_NAME[fact])
    } else {
      answer = queryAnswer(parsed.recipe, await runRecipe(user.dealerId, parsed.recipe))
      context = { recipe: parsed.recipe }
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
