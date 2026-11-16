import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { env, ROOT_DIR } from '../config/env.js'
import { PrismaClient } from '../generated/prisma/client.ts'

// Ready-made demo database with 2 years of fixed data (committed to git).
// It is never written to: on first start it is COPIED to the working database
// (dev.db), so the app works with no setup command and nothing is generated.
// Entries made in the app go into dev.db only; delete dev.db (or run
// npm run db:reset) to get the original demo data back.
export const DEMO_DB = path.join(ROOT_DIR, 'prisma', 'demo.db')

const dbFile = env.databaseUrl.startsWith('file:') ? env.databaseUrl.slice('file:'.length) : null
if (dbFile && !existsSync(dbFile) && existsSync(DEMO_DB)) {
  copyFileSync(DEMO_DB, dbFile)
  console.log('[db] No database yet: copied the demo database (prisma/demo.db).')
}

// One shared client for the whole app. To move to PostgreSQL, swap this
// adapter for @prisma/adapter-pg and change the provider in schema.prisma.
const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl })

export const prisma = new PrismaClient({ adapter })
