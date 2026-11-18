import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { getNotifications } from '../services/notificationService.js'

// Bell notifications for the signed-in user (dealer or manufacturer). Each
// user only gets notifications for the modules their role can open.
export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)

notificationsRouter.get('/', async (req, res) => {
  res.json(await getNotifications(req.user))
})
