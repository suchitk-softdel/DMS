// Puts the original demo data back: replaces the working database (dev.db)
// with a fresh copy of the ready-made prisma/demo.db. Removes anything that
// was entered in the app. Nothing is generated.
//
//   npm run db:reset              (stop the API first)
//   npm run db:reset:keep-users   same, but keeps the login accounts in dev.db
//
// Keep users: every User row of dev.db (name, email, password, role, dealer /
// manufacturer) is saved before the reset and written back after it, so
// people can still sign in with the same email and password. A user whose
// role, dealer or manufacturer is not in the demo data is skipped (listed).

import Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'
import { env } from '../src/config/env.js'
import { DEMO_DB } from '../src/db/prisma.js'

const dbFile = env.databaseUrl.startsWith('file:') ? env.databaseUrl.slice('file:'.length) : null
if (!dbFile) throw new Error('db:reset only works with a SQLite file database.')
if (!existsSync(DEMO_DB)) throw new Error('prisma/demo.db is missing.')

const keepUsers = process.argv.includes('--keep-users')

// 1. Save the current login accounts.
let savedUsers = []
if (keepUsers && existsSync(dbFile)) {
  const db = new Database(dbFile, { readonly: true })
  savedUsers = db.prepare('SELECT * FROM "User"').all()
  db.close()
}

// 2. Put the demo data back.
copyFileSync(DEMO_DB, dbFile)
console.log('Database reset to the original demo data (prisma/demo.db).')

// 3. Write the saved accounts back (new ones added, demo ones updated).
if (keepUsers) {
  const db = new Database(dbFile)
  const exists = (table, id) => id == null || Boolean(db.prepare(`SELECT 1 FROM "${table}" WHERE id = ?`).get(id))
  const upsert = db.prepare(`
    INSERT INTO "User" (id, name, email, passwordHash, roleId, dealerId, manufacturerId, createdAt)
    VALUES (@id, @name, @email, @passwordHash, @roleId, @dealerId, @manufacturerId, @createdAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, email = excluded.email, passwordHash = excluded.passwordHash,
      roleId = excluded.roleId, dealerId = excluded.dealerId, manufacturerId = excluded.manufacturerId`)
  const skipped = []
  let kept = 0
  db.transaction(() => {
    for (const user of savedUsers) {
      const missing = [['Role', user.roleId], ['Dealer', user.dealerId], ['Manufacturer', user.manufacturerId]].filter(([t, id]) => !exists(t, id))
      // Another (demo) account already using this email under a different id.
      const clash = db.prepare('SELECT id FROM "User" WHERE email = ? AND id <> ?').get(user.email, user.id)
      if (missing.length || clash) {
        skipped.push(`${user.email} (${clash ? 'email used by another account' : `${missing.map(([t]) => t.toLowerCase()).join(', ')} not in demo data`})`)
        continue
      }
      upsert.run(user)
      kept++
    }
  })()
  db.close()
  console.log(`Kept ${kept} login account(s).`)
  if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`)
}

process.exit(0)
