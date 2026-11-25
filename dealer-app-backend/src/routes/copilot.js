import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { askCopilot, copilotRecords, rerunCopilot } from '../services/copilotService.js'
import { requiredString } from '../utils/body.js'
import { badRequest, forbidden } from '../utils/httpError.js'

// Copilot (SRS 3.2): in-house question engine. Dealer users ask about their
// own dealership; manufacturer users about all of their dealers (the network
// Copilot). Each answer checks what the user may see (copilotService).
export const copilotRouter = Router()
copilotRouter.use(requireAuth, (req, _res, next) => {
  if (!req.user.dealerId && !req.user.manufacturerId) throw forbidden('The Copilot is for dealer and manufacturer users.')
  next()
})

const contextOf = (body) => (body?.context && typeof body.context === 'object' ? body.context : null)

// Body: { question, context? } where context is the previous answer's
// context (for follow-up questions such as "and last year?").
copilotRouter.post('/ask', async (req, res) => {
  const question = requiredString(req.body?.question, 'question', { maxLength: 300 })
  res.json(await askCopilot(req.user, question, contextOf(req.body)))
})

// A filter chip under an answer was changed. Body: { context, change } where
// change is one of { metric } | { groupBy } | { period } (see rerunCopilot).
copilotRouter.post('/rerun', async (req, res) => {
  const raw = req.body?.change && typeof req.body.change === 'object' ? req.body.change : {}
  const keys = Object.keys(raw).filter((key) => ['metric', 'groupBy', 'period'].includes(key))
  if (keys.length !== 1 || typeof raw[keys[0]] !== 'string') throw badRequest('change must be one of { metric }, { groupBy } or { period }.')
  const answer = await rerunCopilot(req.user, contextOf(req.body), { [keys[0]]: raw[keys[0]] })
  if (!answer) throw badRequest('That filter cannot be applied to this answer.')
  res.json(answer)
})

// The records an answer is based on ("Based on: N records"). Body: { context }.
copilotRouter.post('/records', async (req, res) => {
  const records = await copilotRecords(req.user, contextOf(req.body))
  if (!records) throw badRequest('These records are not available.')
  res.json(records)
})
