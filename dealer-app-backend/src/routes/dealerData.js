import { Router } from 'express'
import {
  CLAIM_STAGES,
  MODULES,
  OPPORTUNITY_STAGES,
  ORDER_STATUSES,
  ORDER_TYPES,
} from '../constants/domain.js'
import { requireAuth, requireModule } from '../middlewares/auth.js'
import { getDealer, listProducts } from '../services/catalogService.js'
import { listClaims } from '../services/claimService.js'
import { listIncentives } from '../services/incentiveService.js'
import { listInventory } from '../services/inventoryService.js'
import { listOpportunities } from '../services/opportunityService.js'
import { getOrder, listOrders } from '../services/orderService.js'
import { listSales, monthlySalesTotals } from '../services/salesService.js'
import { getTrainingOverview } from '../services/trainingService.js'
import { forbidden, notFound } from '../utils/httpError.js'
import { intInRange, optionalEnum, optionalMonth } from '../utils/query.js'

// Every route here returns data for the signed-in user's own dealership only.
// The dealer comes from the session, never from the request, so one dealer
// can't read another dealer's data.
export const dealerDataRouter = Router()
dealerDataRouter.use(requireAuth)

// Dealer profile (FR-HOME-1, FR-D360-1) ---------------------------------------
dealerDataRouter.get('/dealers/:id', async (req, res) => {
  if (req.params.id !== req.user.dealerId) throw forbidden()
  const dealer = await getDealer(req.user.dealerId)
  if (!dealer) throw notFound('Dealer not found.')
  res.json(dealer)
})

// Product catalogue: needed by orders, inventory and warranty screens -----------
dealerDataRouter.get('/products', async (_req, res) => {
  res.json(await listProducts())
})

// Orders & Quotes (SRS 3.4) ---------------------------------------------------
dealerDataRouter.get('/orders', requireModule(MODULES.ORDERS), async (req, res) => {
  res.json(
    await listOrders(req.user.dealerId, {
      type: optionalEnum(req.query.type, ORDER_TYPES, 'type'),
      status: optionalEnum(req.query.status, ORDER_STATUSES, 'status'),
      search: typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined,
      limit: intInRange(req.query.limit, { min: 1, max: 500, fallback: 100, name: 'limit' }),
      offset: intInRange(req.query.offset, { min: 0, max: 1_000_000, fallback: 0, name: 'offset' }),
    }),
  )
})

dealerDataRouter.get('/orders/:id', requireModule(MODULES.ORDERS), async (req, res) => {
  const order = await getOrder(req.user.dealerId, req.params.id)
  if (!order) throw notFound('Order not found.')
  res.json(order)
})

// Sales (Dealer 360 revenue and trends, SRS 3.3) --------------------------------
const salesRange = (query) => ({
  from: optionalMonth(query.from, 'from'),
  to: optionalMonth(query.to, 'to'),
})

dealerDataRouter.get('/sales', requireModule(MODULES.DEALER_360), async (req, res) => {
  res.json(await listSales(req.user.dealerId, salesRange(req.query)))
})

dealerDataRouter.get('/sales/monthly', requireModule(MODULES.DEALER_360), async (req, res) => {
  res.json(await monthlySalesTotals(req.user.dealerId, salesRange(req.query)))
})

// Inventory (SRS 3.5) ---------------------------------------------------------
dealerDataRouter.get('/inventory', requireModule(MODULES.INVENTORY), async (req, res) => {
  res.json(await listInventory(req.user.dealerId))
})

// Warranty & Claims (SRS 3.7) -------------------------------------------------
dealerDataRouter.get('/claims', requireModule(MODULES.WARRANTY), async (req, res) => {
  res.json(
    await listClaims(req.user.dealerId, { stage: optionalEnum(req.query.stage, CLAIM_STAGES, 'stage') }),
  )
})

// Incentives & Training (SRS 3.6) ---------------------------------------------
dealerDataRouter.get('/incentives', requireModule(MODULES.INCENTIVES), async (req, res) => {
  res.json(await listIncentives(req.user.dealerId))
})

dealerDataRouter.get('/training', requireModule(MODULES.INCENTIVES), async (req, res) => {
  res.json(await getTrainingOverview(req.user.id))
})

// Sales Coach (SRS 3.8) -------------------------------------------------------
dealerDataRouter.get('/opportunities', requireModule(MODULES.SALES_COACH), async (req, res) => {
  res.json(
    await listOpportunities(req.user.dealerId, {
      stage: optionalEnum(req.query.stage, OPPORTUNITY_STAGES, 'stage'),
    }),
  )
})
