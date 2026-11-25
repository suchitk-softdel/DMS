import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { addLiveClient } from '../services/liveEvents.js'

// GET /api/live: the browser's live-update connection (Server-Sent Events).
// Stays open; the backend writes an event whenever warranty data of the
// user's dealer (or, for the manufacturer, its network) changes.
export const liveRouter = Router()

const HEARTBEAT_MS = 25_000 // keeps proxies from closing an idle connection

liveRouter.get('/', requireAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()
  res.write('retry: 5000\nevent: ready\ndata: {}\n\n')

  const remove = addLiveClient(res, req.user)
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS)
  req.on('close', () => {
    clearInterval(heartbeat)
    remove()
  })
})
