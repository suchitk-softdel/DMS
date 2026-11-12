import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Backend root folder (dealer-app-backend/).
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// Load .env with Node's built-in loader. Variables already set in the
// environment are not overwritten.
const envFile = path.join(ROOT_DIR, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProd = nodeEnv === 'production'

// SQLite paths in DATABASE_URL are relative to the backend root, so the app,
// the seed script and the Prisma CLI all use the same file.
function resolveDatabaseUrl(url = 'file:./dev.db') {
  if (!url.startsWith('file:')) return url
  const filePath = url.slice('file:'.length)
  return `file:${path.resolve(ROOT_DIR, filePath)}`
}

function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  if (isProd) throw new Error('SESSION_SECRET must be set in production.')
  console.warn('[config] SESSION_SECRET not set: using a random one. Logins reset on every restart.')
  return randomBytes(32).toString('hex')
}

export const env = Object.freeze({
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: resolveDatabaseUrl(process.env.DATABASE_URL),
  sessionSecret: resolveSessionSecret(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 8),
})
