import { prisma } from '../db/prisma.js'

// Live updates (Server-Sent Events): each signed-in browser keeps one
// connection open (GET /api/live). When warranty data changes, the backend
// pushes a small event to the dealer's own users and to its manufacturer, and
// their open screens refresh themselves. No data is sent in the event, only
// what changed; screens reload it through the normal (permission-checked) API.

const clients = new Set() // { res, userId, dealerId, manufacturerId }

// Registers an open connection; returns the function that removes it.
export function addLiveClient(res, user) {
  const client = { res, userId: user.id, dealerId: user.dealerId ?? null, manufacturerId: user.manufacturerId ?? null }
  clients.add(client)
  return () => clients.delete(client)
}

export const liveClientCount = () => clients.size

// Pushes a warranty event to the dealer's users and its manufacturer.
// event: { action: 'claim.submitted' | 'registration.created' | 'investigation.opened' | 'investigation.closed',
//          dealerId, id?, by? (user id) }
// Never throws: a live update must not break the request that caused it.
export async function publishWarrantyEvent({ action, dealerId, id = null, by = null }) {
  try {
    if (!clients.size) return
    const dealer = await prisma.dealer.findUnique({ where: { id: dealerId }, select: { name: true, manufacturerId: true } })
    if (!dealer) return
    const payload = JSON.stringify({ topic: 'warranty', action, id, dealerId, dealerName: dealer.name, by, at: new Date().toISOString() })
    const message = `event: warranty\ndata: ${payload}\n\n`
    for (const client of clients) {
      if (client.dealerId === dealerId || client.manufacturerId === dealer.manufacturerId) client.res.write(message)
    }
  } catch (error) {
    console.error('Live update failed:', error.message)
  }
}
