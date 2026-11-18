import { Router } from 'express'
import { MODULES } from '../constants/domain.js'
import { requireAuth, requireManufacturer, requireModule } from '../middlewares/auth.js'
import {
  APPROVAL_QUEUES,
  approveOrder,
  getApprovalSummary,
  getNetworkOrder,
  listNetworkOrders,
  rejectOrder,
} from '../services/manufacturerService.js'
import { requiredString } from '../utils/body.js'
import { notFound } from '../utils/httpError.js'
import { intInRange, optionalEnum } from '../utils/query.js'

// Manufacturer order desk: approve or reject the orders that dealers send.
// Only manufacturer users with the Order Approvals module; each sees its own
// dealer network only.
export const manufacturerRouter = Router()
manufacturerRouter.use(requireAuth, requireManufacturer, requireModule(MODULES.ORDER_APPROVALS))

// Counts, waiting value, oldest waiting order and pending orders per dealer.
manufacturerRouter.get('/orders/summary', async (req, res) => {
  res.json(await getApprovalSummary(req.user))
})

// ?queue=pending|approved|accepted|closed|fulfilled &dealerId &search &limit &offset
manufacturerRouter.get('/orders', async (req, res) => {
  res.json(
    await listNetworkOrders(req.user, {
      queue: optionalEnum(req.query.queue, APPROVAL_QUEUES, 'queue') ?? 'pending',
      dealerId: typeof req.query.dealerId === 'string' && req.query.dealerId ? req.query.dealerId : undefined,
      search: typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined,
      limit: intInRange(req.query.limit, { min: 1, max: 200, fallback: 25, name: 'limit' }),
      offset: intInRange(req.query.offset, { min: 0, max: 1_000_000, fallback: 0, name: 'offset' }),
    }),
  )
})

manufacturerRouter.get('/orders/:id', async (req, res) => {
  const order = await getNetworkOrder(req.user, req.params.id)
  if (!order) throw notFound('Order not found.')
  res.json(order)
})

// Approve and send the dealer a quote at catalogue prices.
manufacturerRouter.post('/orders/:id/approve', async (req, res) => {
  res.json(await approveOrder(req.user, req.params.id))
})

// Body: { reason } (required, shown to the dealer)
manufacturerRouter.post('/orders/:id/reject', async (req, res) => {
  const reason = requiredString(req.body?.reason, 'reason', { maxLength: 300 })
  res.json(await rejectOrder(req.user, req.params.id, reason))
})
