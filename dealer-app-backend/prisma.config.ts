import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Load .env with Node's built-in loader (no dotenv dependency).
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
