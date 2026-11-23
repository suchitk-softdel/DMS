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

// The classifier's guess is trusted from 45% confidence (or when clearly ahead).
const CONFIDENT = 0.45
// Follow-ups like "and the year before?": move the period back one year.
const RELATIVE_BEFORE = / (?:the )?(?:year before|before that|year earlier|one year earlier|previous one|prior one) /

// Keywords for SPECIAL topics that have their own answer (not a calculation).
// Checked in this order; the first topic whose word is in the question wins.
// e.g. "what is my health score" -> health, "how many furnaces in stock" -> stock.
export const SPECIAL_KEYWORDS = {
  coverage: ['years of data', 'year of data', 'months of data', 'how much data', 'data do we have', 'data do i have', 'data range', 'date range', 'data available', 'data from', 'how far back', 'how old is the data', 'since when', 'first order', 'oldest order', 'oldest data', 'historical data', 'history of data', 'data period', 'data coverage', 'latest data', 'last updated'],
  // After "coverage" (data range), so "data coverage" stays a data question.
  territory: ['territory', 'territory coverage', 'coverage', 'market coverage', 'area covered', 'areas covered', 'how much of my area', 'assigned area', 'my area', 'covered area'],
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
// Greetings and help words -> a welcome message with example questions.
const GREETINGS = ['hi', 'hello', 'hey', 'hey there', 'good morning', 'good afternoon', 'good evening', 'help', 'what can you do', 'what can i ask', 'who are you', 'thanks', 'thank you', 'ok', 'okay']

// Topic guessed by the classifier -> the metric to calculate.
const INTENT_METRIC = { revenue: 'revenue', profit: 'profit', units: 'units', orders: 'orderCount', quotes: 'quoteCount', claims: 'claimCount' }

// Finds the longest dictionary phrase in the text, e.g. "claim amount" beats "claims".
// Used to find the metric ("claim amount", "sales") and the breakdown ("by month").
function longestMatch(text, entries) {
  let best = null
  for (const [key, { words }] of Object.entries(entries)) {
    for (const word of words) {
      if (hasPhrase(text, word) && (!best || word.length > best.length)) best = { key, length: word.length, word }
    }
  }
  return best
}

// Finds the FILTERS in the question:
//   category ("furnaces"), status ("pending"), customer type ("residential"),
//   product SKU ("FN-H96-80"), city ("Denver"), customer name.
// "pending furnace claims in Denver" -> { state: pending, category: furnace, city: Denver }
function findFilters(raw, text, lexicon) {
  const filters = {}
  // Product category, e.g. "heat pumps" -> heatPump
  for (const [category, words] of Object.entries(CATEGORY_WORDS)) {
    if (hasAny(text, words)) filters.category = category
  }
  // Status: the longest matching phrase wins ("under review" beats "review").
  let stateLength = 0
  for (const [state, { words }] of Object.entries(STATE_WORDS)) {
    for (const word of words) {
      if (hasPhrase(text, word) && word.length > stateLength) {
        filters.state = state
        stateLength = word.length
      }
    }
  }
  // Customer type: residential or commercial
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

// Finds the BREAKDOWN: "sales by month", "top 5 products", "which category sold most".
// -> { key: "month" | "product" | ..., singular } or null (no breakdown, just a total).
// singular = true when the question asks for one winner ("which product"),
// false when it asks for a list ("top products", "by product").
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

// Finds the PERIOD (dates) of the question, with sensible defaults:
//   time words in the question -> those dates (period.js)
//   "pending" / "draft" questions -> all time (open items can be old)
//   "by month" with no dates   -> last 12 months
//   otherwise                  -> this year so far
function findPeriod(text, today, recipe) {
  const withoutTarget = text.replace(COMPARE_TARGET, ' ')
  const found = extractPeriod(withoutTarget, today)
  if (found) return found
  if (['pending', 'draft', 'submitted', 'underReview'].includes(recipe.filters.state)) return allTime(today)
  if (recipe.groupBy === 'month') return extractPeriod(' last 12 months ', today)
  return yearToDate(today)
}

// MAIN FUNCTION: question text -> what to do.
// model   = the trained classifier (classifier.js)
// lexicon = SKUs, cities, customer names and all known words (from the database)
// today   = the date questions like "this year" are based on
// context = the previous answer's recipe, for follow-up questions
//
// Example: "top 3 products by profit last year" ->
//   { kind: "query", recipe: { metric: "profit", groupBy: "product", limit: 3,
//     sort: "desc", period: 2025, filters: {} } }
export function parseQuestion(question, { model, lexicon, today, context }) {
  // STEP 1: clean the text and fix spelling (text.js).
  // raw = cleaned text (used for SKUs/cities), text = spelling-corrected text.
  const raw = normalize(question)
  const { text, corrections } = correctSpelling(raw, lexicon.knownWords)
  const trimmed = text.trim()

  // STEP 2: a greeting ("hi", "help") -> welcome answer.
  if (GREETINGS.includes(trimmed)) return { kind: 'special', intent: 'greeting', corrections }

  // STEP 3: "how many customers do I have" -> customer list answer
  // (not a sales question, unless it also says sales/orders/...).
  if (CUSTOMER_COUNT.some((phrase) => text.includes(phrase)) && !hasAny(text, ['bought', 'sales', 'revenue', 'profit', 'orders', 'claims'])) {
    return { kind: 'special', intent: 'customers', corrections }
  }

  // STEP 4: special topics (health score, stock, price, territory, ...).
  // "forecast" is skipped for past questions ("stock sold last year").
  for (const [intent, words] of Object.entries(SPECIAL_KEYWORDS)) {
    if (hasAny(text, words) && !(intent === 'forecast' && hasAny(text, ['sold', 'last year', 'last month']))) {
      // Stock and price answers can be about one product or category.
      const wants = hasAny(text, ['cheapest', 'least expensive', 'lowest price']) ? 'cheapest'
        : hasAny(text, ['most expensive', 'priciest', 'highest price']) ? 'mostExpensive'
        : null
      return { kind: 'special', intent, filters: findFilters(raw, text, lexicon), wants, corrections }
    }
  }

  // STEP 5: find WHAT to calculate (the metric).
  // Metric from the dictionary first, then from the trained classifier.
  const metricMatch = longestMatch(text, METRICS)
  let metric = metricMatch?.key ?? null
  const ranking = predict(model, text)
  const top = ranking[0]

  // Fix the metric for some wordings:
  // "pending order quantity" = units on orders, not units sold.
  const mentionsOrders = hasAny(text, METRICS.orderCount.words)
  const mentionsUnits = hasAny(text, METRICS.units.words)
  if ((metric === 'orderCount' && mentionsUnits) || (metric === 'units' && mentionsOrders && !hasAny(text, ['sold', 'sell', 'selling']))) {
    metric = 'orderUnits'
  }
  // "how many ... sold" asks for a count of units, not money.
  if (metric === 'revenue' && hasPhrase(text, 'how many')) metric = 'units'

  // STEP 6: is this a follow-up to the previous question?
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

  // STEP 7: no metric in the dictionary -> use the classifier if it is confident.
  // It may also point to a special topic (e.g. health), answered directly.
  // Confident = a clear winner: high on its own, or well ahead of the runner-up.
  const clearWinner = top && (top.confidence >= CONFIDENT || (top.confidence >= 0.25 && top.confidence >= 2 * (ranking[1]?.confidence ?? 0)))
  if (!metric && clearWinner && !isFollowUp) {
    if (INTENT_METRIC[top.intent]) metric = INTENT_METRIC[top.intent]
    else return { kind: 'special', intent: top.intent, corrections }
  }
  // "who bought the most", "top 3 cities", "2024?": with no metric, sales is meant.
  if (!metric && !isFollowUp && onlyModifiers && unknownWords.length === 0) metric = 'revenue'

  // STEP 8: still no metric -> unknown question (no known words) or ask back
  // with the 2 most likely topics ("Did you mean sales or profit?").
  if (!metric && !isFollowUp) {
    const meaningful = tokenize(text).filter((word) => !STOP_WORDS.has(word) && lexicon.knownWords.has(word))
    if (meaningful.length === 0 || !top) return { kind: 'unknown', corrections }
    return { kind: 'clarify', options: ranking.slice(0, 2).map((r) => r.intent), corrections }
  }

  // STEP 9: build the RECIPE that the engine (engine.js) will run
  // (starting from the previous recipe for a follow-up).
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
  // The recipe: what to calculate, how to break it down, filters, comparison,
  // sort order and how many rows to show.
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

  // Done: a data question with its recipe, plus any spelling corrections made.
  return { kind: 'query', recipe, corrections }
}
