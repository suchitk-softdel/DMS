// Turns a question into something the engine can run:
//   { kind: 'query',   recipe }            a data question (any combination)
//   { kind: 'special', intent }            health | forecast | incentives | greeting
//   { kind: 'clarify', options }           not sure: ask back
//   { kind: 'unknown' }                    not about the dealer's business data
//
// recipe = { metric, groupBy, filters, period, compare, sort, limit, singular }

import { predict } from './classifier.js'
import { allTime, extractPeriod, previousYear, yearToDate } from './period.js'
import { correctSpelling, hasAny, hasPhrase, normalize, tokenize } from './text.js'
import {
  CATEGORY_WORDS,
  COMPARE_WORDS,
  CUSTOMER_TYPE_WORDS,
  DIMENSIONS,
  FOLLOW_UP_STARTS,
  LOWEST_WORDS,
  METRICS,
  RANKING_WORDS,
  STATE_WORDS,
  STOP_WORDS,
} from './vocabulary.js'

const CONFIDENT = 0.45
const RELATIVE_BEFORE = / (?:the )?(?:year before|before that|year earlier|one year earlier|previous one|prior one) /

export const SPECIAL_KEYWORDS = {
  coverage: ['years of data', 'year of data', 'months of data', 'how much data', 'data do we have', 'data do i have', 'data range', 'date range', 'data available', 'data from', 'how far back', 'how old is the data', 'since when', 'first order', 'oldest order', 'oldest data', 'historical data', 'history of data', 'data period', 'data coverage', 'latest data', 'last updated'],
  // Checked before "forecast", which also reacts to the word "stock".
  stock: ['stock of', 'stock for', 'inventory of', 'inventory for', 'left in stock', 'how many left', 'in stock', 'on hand', 'stock level', 'stock levels', 'inventory value', 'stock value', 'how much stock', 'current stock', 'stock on hand', 'inventory level', 'inventory levels', 'inventory status', 'have in stock', 'stock position', 'units in stock'],
  price: ['price', 'prices', 'pricing', 'list price', 'priced', 'cheapest', 'most expensive', 'how much does', 'price list', 'catalogue', 'catalog', 'cost of a', 'cost of the'],
  health: ['health score', 'health', 'dealer score', 'dealer 360', 'performance score', 'my score', 'rating', 'scorecard'],
  forecast: ['forecast', 'forecasting', 'stock', 'restock', 'reorder', 're order', 'run out', 'running out', 'run short', 'inventory', 'demand', 'predict', 'prediction', 'projection', 'low stock', 'stock out', 'out of stock', 'will sell', 'next month', 'next 30 days', 'coming month', 'upcoming demand'],
  incentives: ['incentive', 'incentives', 'rebate', 'rebates', 'bonus', 'bonuses', 'milestone', 'milestones', 'reward', 'rewards', 'payout', 'payouts', 'program', 'programs'],
  training: ['training', 'trainings', 'course', 'courses', 'certification', 'certifications', 'webinar', 'webinars', 'workshop', 'workshops', 'learning', 'e-learning'],
  opportunities: ['opportunity', 'opportunities', 'pipeline', 'deal', 'deals', 'lead', 'leads', 'prospect', 'prospects', 'win rate', 'winrate', 'competitor', 'competitors', 'negotiation', 'proposal', 'proposals', 'sales coach'],
  roles: ['role', 'roles', 'permission', 'permissions', 'access rights', 'my access', 'what can i access', 'what can i see', 'user roles', 'user types'],
  team: ['user', 'users', 'staff', 'employee', 'employees', 'team', 'team members', 'colleagues', 'technicians', 'sales reps', 'sales representatives', 'people work', 'who works'],
  network: ['dealers', 'dealerships', 'dealer network', 'other dealers', 'network', 'how many dealer', 'number of dealers', 'manufacturer', 'brand'],
}

// "how many customers do I have" is about the customer list, not sales.
const CUSTOMER_COUNT = [' how many customers ', ' how many customer ', ' number of customers ', ' customer count ', ' total customers ', ' count of customers ', ' how many clients ']
const GREETINGS = ['hi', 'hello', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening', 'help', 'what can you do', 'what can i ask', 'who are you', 'thanks', 'thank you', 'ok', 'okay']

// Intent from the classifier -> metric.
const INTENT_METRIC = { revenue: 'revenue', profit: 'profit', units: 'units', orders: 'orderCount', quotes: 'quoteCount', claims: 'claimCount' }

// Longest dictionary phrase found in the text, e.g. "claim amount" beats "claims".
function longestMatch(text, entries) {
  let best = null
  for (const [key, { words }] of Object.entries(entries)) {
    for (const word of words) {
      if (hasPhrase(text, word) && (!best || word.length > best.length)) best = { key, length: word.length, word }
    }
  }
  return best
}

function findFilters(raw, text, lexicon) {
  const filters = {}
  for (const [category, words] of Object.entries(CATEGORY_WORDS)) {
    if (hasAny(text, words)) filters.category = category
  }
  let stateLength = 0
  for (const [state, { words }] of Object.entries(STATE_WORDS)) {
    for (const word of words) {
      if (hasPhrase(text, word) && word.length > stateLength) {
        filters.state = state
        stateLength = word.length
      }
    }
  }
  for (const [type, words] of Object.entries(CUSTOMER_TYPE_WORDS)) {
    if (hasAny(text, words)) filters.customerType = type
  }
  // Values from the database: SKUs, this dealer's cities and customers.
  for (const sku of lexicon.skus) {
    if (hasPhrase(raw, sku.toLowerCase())) filters.sku = sku
  }
  for (const city of lexicon.cities) {
    if (hasPhrase(raw, city.toLowerCase())) filters.city = city
  }
  for (const customer of lexicon.customers) {
    if (customer.length > 6 && hasPhrase(raw, customer.toLowerCase())) filters.customer = customer
  }
  return filters
}

// Time phrases like "last 6 months" or "this month" name a period, not a
// "by month" breakdown, so they are removed before looking for a breakdown.
const PERIOD_PHRASE = / (?:last|past|previous|this|current|next) (?:\d+ |one |two |three |four |five |six |seven |eight |nine |ten |eleven |twelve )?(?:day|days|week|weeks|month|months|year|years|quarter|quarters) /g

function findGroupBy(fullText, fact) {
  const text = fullText.replace(PERIOD_PHRASE, ' ')
  const match = longestMatch(text, DIMENSIONS)
  if (!match || !DIMENSIONS[match.key].facts.includes(fact)) return null
  const asksBreakdown =
    match.key === 'month' ||
    hasAny(text, [...RANKING_WORDS, ...LOWEST_WORDS, 'by', 'per', 'each', 'wise', 'breakdown', 'break down', 'split', 'across'])
  // "which category sold most" names one winner; "sales by category" lists them all.
  const asksForOne = hasAny(text, [...RANKING_WORDS, ...LOWEST_WORDS]) && !hasAny(text, ['by', 'per', 'each', 'wise', 'breakdown', 'break down', 'split'])
  return asksBreakdown ? { key: match.key, singular: asksForOne && !match.word.endsWith('s') } : null
}

// "compare with last year" / "vs last year": the comparison target is not
// the period being asked about.
const COMPARE_TARGET = / (?:with|to|vs|versus|than|against) (?:the )?(?:last|previous|prior) year(?:s)? /

function findPeriod(text, today, recipe) {
  const withoutTarget = text.replace(COMPARE_TARGET, ' ')
  const found = extractPeriod(withoutTarget, today)
  if (found) return found
  if (['pending', 'draft', 'submitted', 'underReview'].includes(recipe.filters.state)) return allTime(today)
  if (recipe.groupBy === 'month') return extractPeriod(' last 12 months ', today)
  return yearToDate(today)
}

export function parseQuestion(question, { model, lexicon, today, context }) {
  const raw = normalize(question)
  const { text, corrections } = correctSpelling(raw, lexicon.knownWords)
  const trimmed = text.trim()

  if (GREETINGS.includes(trimmed)) return { kind: 'special', intent: 'greeting', corrections }

  if (CUSTOMER_COUNT.some((phrase) => text.includes(phrase)) && !hasAny(text, ['bought', 'sales', 'revenue', 'profit', 'orders', 'claims'])) {
    return { kind: 'special', intent: 'customers', corrections }
  }

  // Strong topic words for the special answers.
  for (const [intent, words] of Object.entries(SPECIAL_KEYWORDS)) {
    if (hasAny(text, words) && !(intent === 'forecast' && hasAny(text, ['sold', 'last year', 'last month']))) {
      // Stock and price answers can be about one product or category.
      const wants = hasAny(text, ['cheapest', 'least expensive', 'lowest price']) ? 'cheapest'
        : hasAny(text, ['most expensive', 'priciest', 'highest price']) ? 'mostExpensive'
        : null
      return { kind: 'special', intent, filters: findFilters(raw, text, lexicon), wants, corrections }
    }
  }

  // Metric from the dictionary first, then from the trained classifier.
  const metricMatch = longestMatch(text, METRICS)
  let metric = metricMatch?.key ?? null
  const ranking = predict(model, text)
  const top = ranking[0]

  // "pending order quantity" = units on orders, not units sold.
  const mentionsOrders = hasAny(text, METRICS.orderCount.words)
  const mentionsUnits = hasAny(text, METRICS.units.words)
  if ((metric === 'orderCount' && mentionsUnits) || (metric === 'units' && mentionsOrders && !hasAny(text, ['sold', 'sell', 'selling']))) {
    metric = 'orderUnits'
  }
  if (metric === 'revenue' && hasPhrase(text, 'how many')) metric = 'units'

  // A follow-up ("and last year?", "by month", "compare with last year",
  // "what about heat pumps") changes the previous question instead of
  // starting a new one.
  const dimensionMatch = longestMatch(text.replace(PERIOD_PHRASE, ' '), DIMENSIONS)
  const onlyModifiers =
    !metricMatch &&
    (hasAny(text, COMPARE_WORDS) ||
      COMPARE_TARGET.test(text) ||
      RELATIVE_BEFORE.test(text) ||
      dimensionMatch ||
      extractPeriod(text, today) ||
      Object.keys(findFilters(raw, text, lexicon)).length > 0)
  // Only a question that actually changes something (a period, filter,
  // breakdown or comparison) continues the previous one. Anything else is a
  // new question, so an unrelated question never repeats the last answer.
  // Words the Copilot doesn't know at all (e.g. "weather"): such a question
  // is never treated as a follow-up and never given a default topic.
  const unknownWords = tokenize(text).filter((word) => !lexicon.knownWords.has(word) && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
  const isFollowUp = Boolean(
    context?.recipe &&
      unknownWords.length === 0 &&
      (FOLLOW_UP_STARTS.some((start) => trimmed.startsWith(start.trim())) || (!metricMatch && onlyModifiers)),
  )

  // Confident = a clear winner: high on its own, or well ahead of the runner-up.
  const clearWinner = top && (top.confidence >= CONFIDENT || (top.confidence >= 0.25 && top.confidence >= 2 * (ranking[1]?.confidence ?? 0)))
  if (!metric && clearWinner && !isFollowUp) {
    if (INTENT_METRIC[top.intent]) metric = INTENT_METRIC[top.intent]
    else return { kind: 'special', intent: top.intent, corrections }
  }
  // "who bought the most", "top 3 cities", "2024?": with no metric, sales is meant.
  if (!metric && !isFollowUp && onlyModifiers && unknownWords.length === 0) metric = 'revenue'

  if (!metric && !isFollowUp) {
    const meaningful = tokenize(text).filter((word) => !STOP_WORDS.has(word) && lexicon.knownWords.has(word))
    if (meaningful.length === 0 || !top) return { kind: 'unknown', corrections }
    return { kind: 'clarify', options: ranking.slice(0, 2).map((r) => r.intent), corrections }
  }

  // Build the recipe (starting from the previous one for a follow-up).
  const base = isFollowUp ? context.recipe : null
  metric ??= base.metric
  const fact = METRICS[metric].fact
  // Filters carry over while the question stays on the same kind of records
  // (e.g. furnace sales -> furnace profit).
  const keepFilters = base && METRICS[base.metric].fact === fact
  const filters = { ...(keepFilters ? base.filters : {}), ...findFilters(raw, text, lexicon) }
  // "residential vs commercial" asks for a split, not one type compared with last year.
  const bothCustomerTypes = Object.values(CUSTOMER_TYPE_WORDS).every((words) => hasAny(text, words))
  if (bothCustomerTypes) delete filters.customerType
  const group = findGroupBy(text, fact)
  const recipe = {
    metric,
    groupBy: bothCustomerTypes ? 'customerType' : group?.key ?? (base && !metricMatch ? base.groupBy : null),
    filters,
    compare: bothCustomerTypes ? COMPARE_TARGET.test(text) : hasAny(text, COMPARE_WORDS) || COMPARE_TARGET.test(text),
    sort: hasAny(text, LOWEST_WORDS) ? 'asc' : 'desc',
    // "top 3" -> 3; a plain "by category" breakdown shows every group (max 15).
    limit: Number(text.match(/ top (\d{1,2}) /)?.[1] ?? (hasAny(text, [...RANKING_WORDS, ...LOWEST_WORDS]) ? 5 : 15)),
    singular: group?.singular ?? false,
  }
  // A follow-up keeps the previous period unless it names a new one;
  // "the year before" moves it back one year.
  const explicitPeriod = extractPeriod(text.replace(COMPARE_TARGET, ' '), today)
  if (base && RELATIVE_BEFORE.test(text)) recipe.period = previousYear(base.period)
  else recipe.period = explicitPeriod ?? base?.period ?? findPeriod(text, today, recipe)
  recipe.previousPeriod = recipe.compare ? previousYear(recipe.period) : null

  return { kind: 'query', recipe, corrections }
}
