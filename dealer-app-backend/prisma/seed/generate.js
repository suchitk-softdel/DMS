// Generates ~3 years of realistic, reproducible HVAC dealer data.
//
// Same seed + same end date => identical data, so every developer gets the
// same database. The data has built-in patterns for dashboards and AI to find:
// - HVAC seasonality: cooling peaks in summer, heating peaks in winter with a
//   strong November/December pre-season.
// - Different dealer sizes and growth: Summit grows, Prairie declines,
//   Lakeside is a newer dealer (joined Sept 2025).
// - Inventory risk: furnaces running low going into winter, air conditioners
//   overstocked after summer (for Summit, the demo dealer).
// - Claims in every kanban stage, a few aged beyond the 10-day threshold.

// ---------------------------------------------------------------------------
// Seeded random helpers
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createRandom(seed) {
  const next = mulberry32(seed)
  const random = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted(items, weightOf) {
      const total = items.reduce((sum, item) => sum + weightOf(item), 0)
      let r = next() * total
      for (const item of items) {
        r -= weightOf(item)
        if (r <= 0) return item
      }
      return items[items.length - 1]
    },
  }
  return random
}

// ---------------------------------------------------------------------------
// Date helpers (all dates are UTC midnight-based to keep output stable)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDayUtc = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS)
const daysBetween = (from, to) => Math.floor((to.getTime() - from.getTime()) / DAY_MS)
const monthKey = (date) => date.toISOString().slice(0, 7)
const round2 = (value) => Math.round(value * 100) / 100

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const DEALERS = [
  {
    id: 'd-1001',
    name: 'Summit Comfort Heating & Air',
    city: 'Denver',
    state: 'CO',
    region: 'Mountain West',
    tier: 'Platinum',
    status: 'active',
    territoryCoverage: 0.82,
    scale: 1.0,
    annualGrowth: 0.12,
    joined: null,
  },
  {
    id: 'd-1002',
    name: 'Coastal Climate Solutions',
    city: 'Tampa',
    state: 'FL',
    region: 'Southeast',
    tier: 'Gold',
    status: 'active',
    territoryCoverage: 0.67,
    scale: 0.65,
    annualGrowth: 0.06,
    joined: null,
  },
  {
    id: 'd-1003',
    name: 'Prairie Air Systems',
    city: 'Omaha',
    state: 'NE',
    region: 'Midwest',
    tier: 'Silver',
    status: 'onHold',
    territoryCoverage: 0.41,
    scale: 0.45,
    annualGrowth: -0.1,
    joined: null,
  },
  {
    id: 'd-1004',
    name: 'Lakeside HVAC Services',
    city: 'Madison',
    state: 'WI',
    region: 'Midwest',
    tier: 'Gold',
    status: 'active',
    territoryCoverage: 0.55,
    scale: 0.5,
    annualGrowth: 0.2,
    joined: '2025-09-01',
  },
]

// Monthly demand multipliers, January..December.
const SEASONALITY = {
  cooling: [0.3, 0.35, 0.6, 0.9, 1.4, 1.9, 2.1, 1.9, 1.2, 0.7, 0.4, 0.35],
  heating: [1.8, 1.4, 0.9, 0.5, 0.3, 0.25, 0.25, 0.3, 0.6, 1.3, 2.0, 2.2],
  dual: [1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 1.5, 1.4, 1.0, 1.0, 1.2, 1.25],
  flat: [0.9, 0.9, 0.95, 1.0, 1.05, 1.1, 1.1, 1.05, 1.0, 1.0, 1.0, 1.0],
}

const CATEGORY_INFO = {
  airConditioner: { season: 'cooling', weight: 3.0, equipment: true, maxQty: 2 },
  heatPump: { season: 'dual', weight: 2.2, equipment: true, maxQty: 2 },
  furnace: { season: 'heating', weight: 2.6, equipment: true, maxQty: 2 },
  airHandler: { season: 'dual', weight: 1.2, equipment: true, maxQty: 2 },
  thermostat: { season: 'flat', weight: 1.6, equipment: false, maxQty: 6 },
  indoorAirQuality: { season: 'flat', weight: 1.2, equipment: false, maxQty: 4 },
  parts: { season: 'flat', weight: 2.0, equipment: false, maxQty: 6 },
}

// [sku, name, category, unitPrice, packSize]
const PRODUCT_LIST = [
  ['AC-C14-18', 'Comfort 14 SEER2 Air Conditioner, 1.5 Ton', 'airConditioner', 2850, 1],
  ['AC-C14-24', 'Comfort 14 SEER2 Air Conditioner, 2 Ton', 'airConditioner', 3150, 1],
  ['AC-C14-30', 'Comfort 14 SEER2 Air Conditioner, 2.5 Ton', 'airConditioner', 3450, 1],
  ['AC-C14-36', 'Comfort 14 SEER2 Air Conditioner, 3 Ton', 'airConditioner', 3790, 1],
  ['AC-P17-36', 'Premier 17 SEER2 Air Conditioner, 3 Ton', 'airConditioner', 4890, 1],
  ['AC-P17-48', 'Premier 17 SEER2 Air Conditioner, 4 Ton', 'airConditioner', 5590, 1],
  ['AC-P17-60', 'Premier 17 SEER2 Air Conditioner, 5 Ton', 'airConditioner', 6290, 1],
  ['AC-V20-36', 'Variable-Speed 20 SEER2 Air Conditioner, 3 Ton', 'airConditioner', 7450, 1],
  ['HP-C15-24', 'Comfort 15 SEER2 Heat Pump, 2 Ton', 'heatPump', 3690, 1],
  ['HP-C15-36', 'Comfort 15 SEER2 Heat Pump, 3 Ton', 'heatPump', 4290, 1],
  ['HP-P18-36', 'Premier 18 SEER2 Heat Pump, 3 Ton', 'heatPump', 5690, 1],
  ['HP-P18-48', 'Premier 18 SEER2 Heat Pump, 4 Ton', 'heatPump', 6390, 1],
  ['HP-CC-36', 'Cold-Climate Inverter Heat Pump, 3 Ton', 'heatPump', 7890, 1],
  ['HP-CC-48', 'Cold-Climate Inverter Heat Pump, 4 Ton', 'heatPump', 8690, 1],
  ['FN-S80-60', 'Standard 80% AFUE Gas Furnace, 60k BTU', 'furnace', 1890, 1],
  ['FN-S80-80', 'Standard 80% AFUE Gas Furnace, 80k BTU', 'furnace', 2090, 1],
  ['FN-H96-60', 'High-Efficiency 96% AFUE Gas Furnace, 60k BTU', 'furnace', 2790, 1],
  ['FN-H96-80', 'High-Efficiency 96% AFUE Gas Furnace, 80k BTU', 'furnace', 2990, 1],
  ['FN-H96-100', 'High-Efficiency 96% AFUE Gas Furnace, 100k BTU', 'furnace', 3290, 1],
  ['FN-M98-80', 'Modulating 98% AFUE Gas Furnace, 80k BTU', 'furnace', 4190, 1],
  ['AH-M-24', 'Multi-Position Air Handler, 2 Ton', 'airHandler', 1590, 1],
  ['AH-M-36', 'Multi-Position Air Handler, 3 Ton', 'airHandler', 1890, 1],
  ['AH-V-48', 'Variable-Speed Air Handler, 4 Ton', 'airHandler', 2690, 1],
  ['AH-V-60', 'Variable-Speed Air Handler, 5 Ton', 'airHandler', 2990, 1],
  ['TS-BASIC', 'Programmable Thermostat', 'thermostat', 149, 1],
  ['TS-WIFI', 'Wi-Fi Smart Thermostat', 'thermostat', 249, 1],
  ['TS-COMM', 'Communicating Touchscreen Thermostat', 'thermostat', 429, 1],
  ['TS-ZONE', 'Zoning Control Panel, 4 Zones', 'thermostat', 689, 1],
  ['IAQ-FLT16', 'MERV 13 Media Filter 16x25x4', 'indoorAirQuality', 69, 12],
  ['IAQ-HUM', 'Whole-Home Steam Humidifier', 'indoorAirQuality', 1290, 1],
  ['IAQ-UV', 'UV-C Germicidal Light', 'indoorAirQuality', 549, 1],
  ['IAQ-ERV', 'Energy Recovery Ventilator', 'indoorAirQuality', 1890, 1],
  ['PT-CAP45', 'Dual Run Capacitor 45/5 MFD', 'parts', 32, 10],
  ['PT-CONT', 'Contactor 2-Pole 30A', 'parts', 28, 10],
  ['PT-FANMTR', 'Condenser Fan Motor 1/4 HP', 'parts', 189, 5],
  ['PT-IGN', 'Hot Surface Igniter', 'parts', 46, 10],
  ['PT-FLAME', 'Flame Sensor', 'parts', 24, 10],
  ['PT-CTRL', 'Furnace Control Board', 'parts', 289, 5],
  ['PT-COIL36', 'Evaporator Coil, 3 Ton', 'parts', 1090, 1],
  ['PT-COMP36', 'Scroll Compressor, 3 Ton', 'parts', 1290, 1],
]

const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Linda', 'Michael', 'Patricia', 'David', 'Jennifer', 'Daniel',
  'Elizabeth', 'Thomas', 'Susan', 'Kevin', 'Karen', 'Brian', 'Nancy', 'Jason', 'Lisa', 'Ryan',
  'Angela', 'Eric', 'Emily', 'Aaron', 'Priya', 'Carlos', 'Mei', 'Omar', 'Grace', 'Luis', 'Hannah',
]
const LAST_NAMES = [
  'Anderson', 'Baker', 'Carter', 'Diaz', 'Evans', 'Foster', 'Garcia', 'Hughes', 'Iverson', 'Jensen',
  'Kim', 'Lopez', 'Mitchell', 'Nguyen', 'Olsen', 'Patel', 'Quinn', 'Reyes', 'Schmidt', 'Turner',
  'Underwood', 'Vasquez', 'Walsh', 'Young', 'Zimmerman', 'Brooks', 'Coleman', 'Hayes', 'Price', 'Ross',
]
const BUSINESS_TYPES = [
  'Dental Group', 'Family Clinic', 'Office Park', 'Apartments', 'Bakery', 'Fitness Center',
  'Elementary School', 'Community Church', 'Auto Service', 'Medical Plaza', 'Hotel', 'Brewing Co.',
]
const BUSINESS_PREFIXES = [
  'Hillcrest', 'Riverside', 'Maple', 'Cedar Ridge', 'Northgate', 'Lakeview', 'Pinecrest', 'Oak Hollow',
  'Summit', 'Westbrook', 'Harbor', 'Meadowlark',
]
const CITIES_BY_DEALER = {
  'd-1001': ['Denver', 'Aurora', 'Lakewood', 'Littleton', 'Arvada', 'Englewood'],
  'd-1002': ['Tampa', 'Brandon', 'Clearwater', 'St. Petersburg', 'Riverview'],
  'd-1003': ['Omaha', 'Bellevue', 'Papillion', 'La Vista', 'Council Bluffs'],
  'd-1004': ['Madison', 'Middleton', 'Sun Prairie', 'Fitchburg', 'Verona'],
}

const CLAIM_REASONS = {
  airConditioner: ['Compressor failure, unit not cooling', 'Refrigerant leak in outdoor coil', 'Condenser fan motor failed'],
  heatPump: ['Reversing valve stuck in cooling mode', 'Defrost control board failure', 'Compressor not starting'],
  furnace: ['Heat exchanger crack found on inspection', 'Inducer motor failure', 'Ignition control lockout'],
  airHandler: ['Blower motor failure', 'Evaporator coil leak', 'Control board fault'],
}

const COMPETITORS = ['Northwind Comfort', 'BlueAir Systems', 'Polar Climate Co.', 'Apex Heating Group']

const OPPORTUNITY_TEMPLATES = [
  { title: 'Whole-home system replacement', need: 'Replace a 20-year-old furnace and AC with an efficient system', budget: [9000, 18000], commercial: false },
  { title: 'Heat pump conversion', need: 'Move from gas heating to an electric heat pump to cut energy bills', budget: [11000, 22000], commercial: false },
  { title: 'Furnace replacement before winter', need: 'Failing furnace; wants a high-efficiency unit installed before cold weather', budget: [4000, 8000], commercial: false },
  { title: 'Indoor air quality upgrade', need: 'Allergies in the household; interested in filtration, UV and humidity control', budget: [1500, 4500], commercial: false },
  { title: 'Smart thermostat and zoning', need: 'Uneven temperatures between floors; wants zoning and smart controls', budget: [1500, 4000], commercial: false },
  { title: 'Rooftop unit upgrade', need: 'Replace aging rooftop units serving the main building', budget: [35000, 90000], commercial: true },
  { title: 'Multi-unit HVAC retrofit', need: 'Retrofit heating and cooling across several apartment units', budget: [60000, 160000], commercial: true },
  { title: 'Preventive maintenance contract', need: 'Annual maintenance agreement for all HVAC equipment on site', budget: [6000, 15000], commercial: true },
]

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateData({ seed = 42, endDate = new Date(), years = 3 } = {}) {
  const random = createRandom(seed)
  const end = startOfDayUtc(endDate)
  const start = new Date(Date.UTC(end.getUTCFullYear() - years, end.getUTCMonth(), 1))

  const dealers = DEALERS.map(({ scale: _s, annualGrowth: _g, joined: _j, ...dealer }) => ({
    ...dealer,
    createdAt: start,
  }))

  const products = PRODUCT_LIST.map(([sku, name, category, unitPrice, packSize], index) => ({
    id: `p-${String(index + 1).padStart(3, '0')}`,
    sku,
    name,
    category,
    unitPrice,
    unitCost: round2(unitPrice * random.float(0.66, 0.76)),
    packSize,
  }))
  const productById = new Map(products.map((p) => [p.id, p]))

  // Customers -----------------------------------------------------------------
  const customers = []
  let customerSeq = 1
  for (const dealer of DEALERS) {
    const count = Math.round(140 * dealer.scale) + 20
    for (let i = 0; i < count; i += 1) {
      const commercial = random.chance(0.18)
      customers.push({
        id: `c-${String(customerSeq++).padStart(5, '0')}`,
        dealerId: dealer.id,
        name: commercial
          ? `${random.pick(BUSINESS_PREFIXES)} ${random.pick(BUSINESS_TYPES)}`
          : `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
        type: commercial ? 'commercial' : 'residential',
        city: random.pick(CITIES_BY_DEALER[dealer.id]),
      })
    }
  }
  const customersByDealer = Map.groupBy(customers, (c) => c.dealerId)

  // Orders and quotes -----------------------------------------------------------
  const orders = []
  const orderItems = []
  let orderSeq = 100000
  const totalDays = daysBetween(start, end)

  for (const dealer of DEALERS) {
    const dealerStart = dealer.joined ? new Date(`${dealer.joined}T00:00:00Z`) : start
    const dealerCustomers = customersByDealer.get(dealer.id)
    // Each month varies by +/-12% around the expected volume. Orders are then
    // spread evenly over the working days, so no month dips by chance alone
    // (a random dip would look like a real trend to dashboards and AI).
    const monthFactors = new Map()
    let pending = 0

    // Up to yesterday, so no order is timestamped later than "now".
    for (let day = 0; day < totalDays; day += 1) {
      const date = addDays(start, day)
      if (date < dealerStart) continue
      const dow = date.getUTCDay()
      if (dow === 0) continue // closed on Sundays

      const yearsElapsed = day / 365
      const growth = (1 + dealer.annualGrowth) ** yearsElapsed
      const month = date.getUTCMonth()
      const seasonBoost = (SEASONALITY.cooling[month] + SEASONALITY.heating[month]) / 2.2
      const key = monthKey(date)
      if (!monthFactors.has(key)) monthFactors.set(key, random.float(0.88, 1.12))
      const dailyMean =
        (30 / 26) * dealer.scale * growth * (0.55 + 0.45 * seasonBoost) * monthFactors.get(key) * (dow === 6 ? 0.5 : 1)

      pending += dailyMean
      const count = Math.floor(pending)
      pending -= count
      for (let n = 0; n < count; n += 1) {
        const ageDays = daysBetween(date, end)
        const type = random.chance(0.25) ? 'quote' : 'order'
        const id = `${type === 'quote' ? 'QT' : 'ORD'}-${orderSeq++}`
        const createdAt = new Date(date.getTime() + random.int(8, 17) * 3600 * 1000 + random.int(0, 59) * 60000)

        // Order lines: product choice follows category weight x seasonality.
        const lineCount = random.weighted([1, 2, 3], (k) => [0.5, 0.35, 0.15][k - 1])
        const chosen = new Set()
        let total = 0
        for (let l = 0; l < lineCount; l += 1) {
          const product = random.weighted(products, (p) => {
            const info = CATEGORY_INFO[p.category]
            return chosen.has(p.id) ? 0 : info.weight * SEASONALITY[info.season][month]
          })
          chosen.add(product.id)
          const info = CATEGORY_INFO[product.category]
          const quantity = random.int(1, info.maxQty)
          const unitPrice = round2(product.unitPrice * random.float(0.92, 1.0))
          total += quantity * unitPrice
          orderItems.push({ orderId: id, productId: product.id, quantity, unitPrice })
        }

        orders.push({
          id,
          dealerId: dealer.id,
          customerId: random.pick(dealerCustomers).id,
          createdById: null,
          type,
          status: pickOrderStatus(random, type, ageDays),
          total: round2(total),
          createdAt,
          updatedAt: new Date(Math.min(addDays(createdAt, random.int(0, 10)).getTime(), end.getTime())),
        })
      }
    }
  }
  const orderById = new Map(orders.map((o) => [o.id, o]))

  // Monthly sales from fulfilled orders -----------------------------------------
  const salesMap = new Map()
  for (const item of orderItems) {
    const order = orderById.get(item.orderId)
    if (order.type !== 'order' || order.status !== 'fulfilled') continue
    const month = monthKey(order.createdAt)
    const key = `${order.dealerId}|${item.productId}|${month}`
    const row =
      salesMap.get(key) ??
      { dealerId: order.dealerId, productId: item.productId, month, units: 0, revenue: 0, cost: 0 }
    const product = productById.get(item.productId)
    row.units += item.quantity
    row.revenue = round2(row.revenue + item.quantity * item.unitPrice)
    row.cost = round2(row.cost + item.quantity * product.unitCost)
    salesMap.set(key, row)
  }
  const sales = [...salesMap.values()]

  // Inventory: stock is planned for the coming month's seasonal demand ----------
  // (trailing 12-month average x the season factor for the current month).
  const trailingMonths = new Set(
    Array.from({ length: 12 }, (_, i) =>
      monthKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1 - i, 1))),
    ),
  )
  const trailingUnits = new Map()
  for (const row of sales) {
    if (!trailingMonths.has(row.month)) continue
    const key = `${row.dealerId}|${row.productId}`
    trailingUnits.set(key, (trailingUnits.get(key) ?? 0) + row.units)
  }
  const inventory = []
  for (const dealer of DEALERS) {
    for (const product of products) {
      const season = SEASONALITY[CATEGORY_INFO[product.category].season][end.getUTCMonth()]
      const monthlyDemand = ((trailingUnits.get(`${dealer.id}|${product.id}`) ?? 0) / 12) * season
      const reorderPoint = Math.max(1, Math.ceil(monthlyDemand * 0.75))
      let onHand = Math.round(monthlyDemand * random.float(0.4, 2.2)) + random.int(0, 2)
      let onOrder = random.chance(0.25) ? Math.ceil(monthlyDemand * random.float(0.3, 1)) : 0

      // Demo dealer: heating stock is short going into winter, cooling stock is high.
      if (dealer.id === 'd-1001' && ['FN-H96-80', 'FN-S80-80', 'HP-CC-36'].includes(product.sku)) {
        onHand = random.int(0, 2)
        onOrder = 0
      }
      if (dealer.id === 'd-1001' && ['AC-P17-48', 'AC-C14-36'].includes(product.sku)) {
        onHand = random.int(14, 22)
        onOrder = 0
      }
      inventory.push({ dealerId: dealer.id, productId: product.id, onHand, onOrder, reorderPoint, updatedAt: end })
    }
  }

  // Warranty registrations and claims -------------------------------------------
  const registrations = []
  const claims = []
  let serialSeq = 5000000
  let claimSeq = 20000
  for (const item of orderItems) {
    const order = orderById.get(item.orderId)
    const product = productById.get(item.productId)
    if (order.type !== 'order' || order.status !== 'fulfilled') continue
    if (!CATEGORY_INFO[product.category].equipment) continue

    for (let unit = 0; unit < item.quantity; unit += 1) {
      if (!random.chance(0.7)) continue // not every unit gets registered
      const installDate = addDays(order.createdAt, random.int(2, 14))
      if (installDate > end) continue
      const serialNumber = `SN${serialSeq++}`
      registrations.push({
        id: `wr-${serialNumber}`,
        dealerId: order.dealerId,
        productId: product.id,
        customerId: order.customerId,
        serialNumber,
        installDate,
        createdAt: installDate,
      })

      if (!random.chance(0.035)) continue
      const filedAt = addDays(installDate, random.int(30, 720))
      if (filedAt > end) continue
      claims.push(buildClaim(random, { claimSeq: claimSeq++, order, product, serialNumber, filedAt, end }))
    }
  }

  // Open claims filed in the last 40 days, so the claims board (FR-WAR-2) has
  // cards in every stage, including some aged past the 10-day alert (FR-WAR-5).
  const registrationsByDealer = Map.groupBy(registrations, (r) => r.dealerId)
  for (const dealer of DEALERS) {
    const pool = registrationsByDealer.get(dealer.id) ?? []
    const count = Math.round(14 * dealer.scale) + 2
    for (let i = 0; i < count && pool.length; i += 1) {
      const registration = random.pick(pool)
      const filedAt = addDays(end, -random.int(1, 40))
      if (filedAt <= registration.installDate) continue
      claims.push(
        buildClaim(random, {
          claimSeq: claimSeq++,
          order: { dealerId: dealer.id, customerId: registration.customerId },
          product: productById.get(registration.productId),
          serialNumber: registration.serialNumber,
          filedAt,
          end,
          stage: OPEN_CLAIM_STAGES[i % OPEN_CLAIM_STAGES.length],
        }),
      )
    }
  }

  // Incentives, training, opportunities -----------------------------------------
  const year = end.getUTCFullYear()
  const incentivePrograms = buildIncentivePrograms(year)
  const trainingCourses = buildTrainingCourses(end)
  const opportunities = buildOpportunities(random, { dealers: DEALERS, customersByDealer, end })

  const incentiveProgress = []
  for (const dealer of DEALERS) {
    for (const program of incentivePrograms) {
      const current = programProgress(program, dealer, { sales, productById, random })
      const milestones = JSON.parse(program.milestones)
      const reached = milestones.filter((m) => current >= m.target)
      incentiveProgress.push({
        dealerId: dealer.id,
        programId: program.id,
        current: round2(current),
        earned: reached.length ? reached[reached.length - 1].payout : 0,
      })
    }
  }

  return {
    range: { start, end },
    dealers,
    products,
    customers,
    orders,
    orderItems,
    sales,
    inventory,
    registrations,
    claims,
    incentivePrograms,
    incentiveProgress,
    trainingCourses,
    opportunities,
    // Training progress is per user, so seed.js builds it once users exist.
    buildTrainingProgress: (users) => buildTrainingProgress(random, users, trainingCourses, end),
  }
}

function pickOrderStatus(random, type, ageDays) {
  if (type === 'quote') {
    if (ageDays > 30) return random.chance(0.6) ? 'approved' : 'submitted'
    return random.weighted(['draft', 'submitted', 'approved'], (s) => ({ draft: 0.3, submitted: 0.5, approved: 0.2 })[s])
  }
  // Most orders are fulfilled within about a week, so recent months' revenue
  // isn't artificially low.
  if (ageDays > 10) return 'fulfilled'
  if (ageDays > 3) return random.chance(0.4) ? 'approved' : 'fulfilled'
  return random.weighted(['draft', 'submitted', 'approved'], (s) => ({ draft: 0.2, submitted: 0.5, approved: 0.3 })[s])
}

// Kanban stages for recent claims, cycled so every column has cards.
const OPEN_CLAIM_STAGES = ['submitted', 'underReview', 'approved', 'underReview', 'reimbursed']

function buildClaim(random, { claimSeq, order, product, serialNumber, filedAt, end, stage: forcedStage }) {
  const ageDays = daysBetween(filedAt, end)
  let stage
  let stageChangedAt
  let resolvedAt = null

  if (ageDays > 45) {
    stage = random.chance(0.88) ? 'reimbursed' : 'rejected'
    resolvedAt = addDays(filedAt, random.int(6, 30))
    stageChangedAt = resolvedAt
  } else {
    stage =
      forcedStage ??
      random.weighted(
        ['submitted', 'underReview', 'approved', 'reimbursed'],
        (s) => ({ submitted: 0.3, underReview: 0.35, approved: 0.2, reimbursed: 0.15 })[s],
      )
    const daysInStage = Math.min(ageDays, stage === 'underReview' ? random.int(1, 16) : random.int(0, 8))
    stageChangedAt = addDays(end, -daysInStage)
    if (stage === 'reimbursed') resolvedAt = stageChangedAt
  }

  const isPart = random.chance(0.6)
  const amount = isPart ? random.float(120, 900) : random.float(900, 2600)
  return {
    id: `CLM-${claimSeq}`,
    dealerId: order.dealerId,
    productId: product.id,
    customerId: order.customerId,
    serialNumber,
    amount: round2(amount),
    description: random.pick(CLAIM_REASONS[product.category]),
    stage,
    filedAt,
    stageChangedAt,
    resolvedAt,
  }
}

function buildIncentivePrograms(year) {
  const date = (m, d) => new Date(Date.UTC(year, m - 1, d))
  return [
    {
      id: `INC-${year}-GROWTH`,
      name: `${year} Volume Growth`,
      description: 'Tiered rebate on total equipment and parts revenue for the calendar year.',
      metric: 'revenue',
      startDate: date(1, 1),
      endDate: date(12, 31),
      milestones: JSON.stringify([
        { target: 500000, payout: 5000 },
        { target: 1000000, payout: 12500 },
        { target: 2000000, payout: 30000 },
      ]),
    },
    {
      id: `INC-${year}-HEATPUMP`,
      name: 'Heat Pump Push',
      description: 'Bonus per heat pump milestone sold in the second half of the year.',
      metric: 'units',
      startDate: date(7, 1),
      endDate: date(12, 31),
      milestones: JSON.stringify([
        { target: 25, payout: 2500 },
        { target: 50, payout: 6000 },
        { target: 100, payout: 15000 },
      ]),
    },
    {
      id: `INC-${year}-FURNACE`,
      name: 'Q4 Furnace Pre-Season',
      description: 'Bonus for furnace units sold between October and December.',
      metric: 'units',
      startDate: date(10, 1),
      endDate: date(12, 31),
      milestones: JSON.stringify([
        { target: 15, payout: 1500 },
        { target: 30, payout: 4000 },
      ]),
    },
    {
      id: `INC-${year}-CERTIFIED`,
      name: 'Certified Dealer Bonus',
      description: 'Bonus for training hours completed by dealership staff this year.',
      metric: 'trainingHours',
      startDate: date(1, 1),
      endDate: date(12, 31),
      milestones: JSON.stringify([
        { target: 20, payout: 1000 },
        { target: 40, payout: 2500 },
      ]),
    },
  ]
}

const PROGRAM_CATEGORY = { HEATPUMP: 'heatPump', FURNACE: 'furnace' }

function programProgress(program, dealer, { sales, productById, random }) {
  if (program.metric === 'trainingHours') {
    return dealer.id === 'd-1001' ? 26 : random.int(4, 44)
  }
  const from = monthKey(program.startDate)
  const to = monthKey(program.endDate)
  const category = PROGRAM_CATEGORY[program.id.split('-')[2]]
  let total = 0
  for (const row of sales) {
    if (row.dealerId !== dealer.id || row.month < from || row.month > to) continue
    if (program.metric === 'revenue') total += row.revenue
    else if (productById.get(row.productId).category === category) total += row.units
  }
  return total
}

function buildTrainingCourses(end) {
  const upcoming = (days) => addDays(end, days)
  return [
    { id: 'tr-101', title: 'Heat Pump Fundamentals', category: 'product', durationHours: 4, certification: 'Heat Pump Specialist', scheduledAt: null },
    { id: 'tr-102', title: 'Cold-Climate Heat Pump Installation', category: 'installation', durationHours: 6, certification: 'Cold-Climate Installer', scheduledAt: null },
    { id: 'tr-103', title: 'High-Efficiency Furnace Service', category: 'service', durationHours: 5, certification: null, scheduledAt: null },
    { id: 'tr-104', title: 'Refrigerant Handling Refresher', category: 'safety', durationHours: 3, certification: 'Refrigerant Handling', scheduledAt: null },
    { id: 'tr-105', title: 'Communicating Controls Setup', category: 'installation', durationHours: 2, certification: null, scheduledAt: null },
    { id: 'tr-106', title: 'Consultative Selling for HVAC', category: 'sales', durationHours: 3, certification: null, scheduledAt: null },
    { id: 'tr-107', title: 'Indoor Air Quality Solutions', category: 'product', durationHours: 2, certification: 'IAQ Specialist', scheduledAt: null },
    { id: 'tr-108', title: 'Warranty Claims Best Practices', category: 'service', durationHours: 1.5, certification: null, scheduledAt: null },
    { id: 'tr-109', title: 'Ladder and Rooftop Safety', category: 'safety', durationHours: 1, certification: null, scheduledAt: null },
    { id: 'tr-201', title: 'Webinar: 2027 Product Line Preview', category: 'product', durationHours: 1, certification: null, scheduledAt: upcoming(9) },
    { id: 'tr-202', title: 'Webinar: Selling Heat Pumps in Winter', category: 'sales', durationHours: 1, certification: null, scheduledAt: upcoming(16) },
    { id: 'tr-203', title: 'Live Workshop: Variable-Speed Diagnostics', category: 'service', durationHours: 4, certification: null, scheduledAt: upcoming(27) },
  ]
}

function buildTrainingProgress(random, users, courses, end) {
  const rows = []
  const selfPaced = courses.filter((c) => !c.scheduledAt)
  for (const user of users) {
    for (const course of selfPaced) {
      if (!random.chance(0.7)) continue
      const done = random.chance(0.55)
      const completionPct = done ? 100 : random.pick([10, 25, 40, 60, 75, 90])
      rows.push({
        userId: user.id,
        courseId: course.id,
        completionPct,
        completedAt: done ? addDays(end, -random.int(5, 300)) : null,
      })
    }
  }
  return rows
}

function buildOpportunities(random, { dealers, customersByDealer, end }) {
  const rows = []
  let seq = 3000
  for (const dealer of dealers) {
    const count = Math.round(40 * dealer.scale) + 6
    for (let i = 0; i < count; i += 1) {
      const template = random.pick(OPPORTUNITY_TEMPLATES)
      const pool = customersByDealer
        .get(dealer.id)
        .filter((c) => (template.commercial ? c.type === 'commercial' : c.type === 'residential'))
      const customer = random.pick(pool.length ? pool : customersByDealer.get(dealer.id))
      const open = random.chance(0.6)
      const createdAt = addDays(end, -random.int(open ? 3 : 60, open ? 60 : 500))
      rows.push({
        id: `OPP-${seq++}`,
        dealerId: dealer.id,
        customerId: customer.id,
        title: template.title,
        need: template.need,
        budget: Math.round(random.float(...template.budget) / 100) * 100,
        decisionDate: open ? addDays(end, random.int(7, 75)) : addDays(createdAt, random.int(14, 60)),
        stage: open
          ? random.weighted(['new', 'qualified', 'proposal', 'negotiation'], (s) => ({ new: 0.25, qualified: 0.3, proposal: 0.3, negotiation: 0.15 })[s])
          : random.chance(0.55) ? 'won' : 'lost',
        competitor: random.chance(0.45) ? random.pick(COMPETITORS) : null,
        createdAt,
      })
    }
  }
  return rows
}
