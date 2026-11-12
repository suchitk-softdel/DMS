import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { env } from '../config/env.js'
import { PrismaClient } from '../generated/prisma/client.ts'

// One shared client for the whole app. To move to PostgreSQL, swap this
// adapter for @prisma/adapter-pg and change the provider in schema.prisma.
const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl })

export const prisma = new PrismaClient({ adapter })
