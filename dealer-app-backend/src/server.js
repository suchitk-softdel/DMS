import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db/prisma.js'

const server = createApp().listen(env.port, () => {
  console.log(`Dealer App API listening on http://localhost:${env.port}/api`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
