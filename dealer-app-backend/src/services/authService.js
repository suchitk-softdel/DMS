import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../db/prisma.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

export const SESSION_COOKIE = 'dealer_session'

// Used when the email is unknown, so a failed login takes the same time
// whether or not the account exists.
const dummyHashPromise = hashPassword('not-a-real-password')

// Where the user works, shown in the menu: the dealership, or the manufacturer.
const ORGANIZATION = {
  dealer: { select: { name: true, tier: true, region: true } },
  manufacturer: { select: { name: true } },
}

function organizationOf(user) {
  if (user.dealer) return { type: 'dealer', name: user.dealer.name, tier: user.dealer.tier, region: user.dealer.region }
  if (user.manufacturer) return { type: 'manufacturer', name: user.manufacturer.name }
  return null
}

export function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    dealerId: user.dealerId,
    manufacturerId: user.manufacturerId,
    organization: organizationOf(user),
  }
}

export async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: ORGANIZATION })
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHashPromise))
  return valid && user ? user : null
}

export function createSessionToken(user) {
  return jwt.sign({ sub: user.id }, env.sessionSecret, { expiresIn: `${env.sessionTtlHours}h` })
}

export function sessionCookieOptions() {
  return {
    httpOnly: true, // not readable from browser JavaScript
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  }
}

// Returns the signed-in user with their role permissions, or null.
export async function getSessionUser(token) {
  if (!token) return null
  let payload
  try {
    payload = jwt.verify(token, env.sessionSecret)
  } catch {
    return null
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true, ...ORGANIZATION } })
  if (!user) return null
  return { ...toPublicUser(user), permissions: JSON.parse(user.role.permissions) }
}
