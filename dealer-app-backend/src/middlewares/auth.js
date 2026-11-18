import { getSessionUser, SESSION_COOKIE } from '../services/authService.js'
import { forbidden, unauthorized } from '../utils/httpError.js'

// Requires a valid session. Sets req.user = { id, name, email, roleId,
// dealerId, permissions }. Permissions are re-read from the database on every
// request, so role changes apply immediately.
export async function requireAuth(req, _res, next) {
  const user = await getSessionUser(req.cookies?.[SESSION_COOKIE])
  if (!user) throw unauthorized()
  req.user = user
  next()
}

// Dealer data routes: only users who work for a dealer (the manufacturer's
// order desk has no dealer and no dealer data).
export function requireDealer(req, _res, next) {
  if (!req.user.dealerId) throw forbidden('This page is for dealer users.')
  next()
}

// Manufacturer routes: only users who work for the manufacturer.
export function requireManufacturer(req, _res, next) {
  if (!req.user.manufacturerId) throw forbidden('This page is for manufacturer users.')
  next()
}

// Requires the user's role to include at least one of the given modules.
// Use after requireAuth. This is the real access check: the frontend's
// checks only hide things, they don't protect data (SRS 6.2).
export function requireModule(...moduleKeys) {
  return (req, _res, next) => {
    if (!moduleKeys.some((key) => req.user.permissions.includes(key))) throw forbidden()
    next()
  }
}
