import cookieParser from 'cookie-parser'
import express from 'express'
import { prisma } from './db/prisma.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { authRouter, rolesRouter } from './routes/auth.js'
import { dealerDataRouter } from './routes/dealerData.js'
import { liveRouter } from './routes/live.js'
import { manufacturerRouter } from './routes/manufacturer.js'
import { notificationsRouter } from './routes/notifications.js'

// The frontend reaches this API through the Vite dev-server proxy (same
// origin), so no CORS setup is needed in development.
export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/roles', rolesRouter)
  // Before the dealer routes, which are mounted on /api and accept dealer users only.
  app.use('/api/manufacturer', manufacturerRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/live', liveRouter)
  app.use('/api', dealerDataRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
