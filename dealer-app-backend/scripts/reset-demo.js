// Puts the original demo data back: replaces the working database (dev.db)
// with a fresh copy of the ready-made prisma/demo.db. Removes anything that
// was entered in the app. Nothing is generated.
//
//   npm run db:reset    (stop the API first)

import { copyFileSync, existsSync } from 'node:fs'
import { env } from '../src/config/env.js'
import { DEMO_DB } from '../src/db/prisma.js'

const dbFile = env.databaseUrl.startsWith('file:') ? env.databaseUrl.slice('file:'.length) : null
if (!dbFile) throw new Error('db:reset only works with a SQLite file database.')
if (!existsSync(DEMO_DB)) throw new Error('prisma/demo.db is missing.')

copyFileSync(DEMO_DB, dbFile)
console.log('Database reset to the original demo data (prisma/demo.db).')
process.exit(0)
