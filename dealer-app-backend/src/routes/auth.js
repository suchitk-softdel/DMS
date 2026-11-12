import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { logAudit } from '../services/auditLog.js'
import {
  authenticate,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  toPublicUser,
} from '../services/authService.js'
import { listRoles } from '../services/catalogService.js'
import { badRequest, unauthorized } from '../utils/httpError.js'

// Demo login with email + password. To be replaced by OAuth2 / OIDC with the
// manufacturer's identity provider (SRS 4.4); the session cookie stays the same.
export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw badRequest('Email and password are required.')
  }

  const user = await authenticate(email, password)
  if (!user) throw unauthorized('Invalid email or password.')

  res.cookie(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions())
  await logAudit({ userId: user.id, action: 'auth.login' })
  res.json(toPublicUser(user))
})

authRouter.post('/logout', async (req, res) => {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions()
  res.clearCookie(SESSION_COOKIE, options)
  res.status(204).end()
})

// Who is signed in (used by the app on start-up to check the session).
authRouter.get('/me', requireAuth, (req, res) => {
  const { permissions: _permissions, ...user } = req.user
  res.json(user)
})

// Roles and their modules. Public: the app needs them to build the menu, and
// they contain no dealer data.
export const rolesRouter = Router()

rolesRouter.get('/', async (_req, res) => {
  res.json(await listRoles())
})
