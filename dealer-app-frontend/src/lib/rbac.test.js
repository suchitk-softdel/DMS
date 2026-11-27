import { describe, expect, test } from 'vitest'
import { MODULE_PATHS, MODULES, PUBLIC_PATHS } from '@/constants/modules'
import { canAccess, getHomePath, getRole } from '@/lib/rbac'
import { ROLES } from '@/test/utils'

describe('getRole', () => {
  test('finds a role by id', () => expect(getRole(ROLES, 'dealer').name).toBe('Dealer'))
  test('unknown role is null', () => expect(getRole(ROLES, 'nobody')).toBeNull())
})

describe('canAccess', () => {
  test('allowed module', () => expect(canAccess(ROLES, 'dealer', MODULES.INVENTORY)).toBe(true))
  test('module missing from the role', () => expect(canAccess(ROLES, 'limited', MODULES.ORDERS)).toBe(false))
  test('dealer cannot open manufacturer approvals', () => expect(canAccess(ROLES, 'dealer', MODULES.ORDER_APPROVALS)).toBe(false))
  test('manufacturer cannot open dealer modules', () => expect(canAccess(ROLES, 'manufacturer', MODULES.HOME)).toBe(false))
  test('unknown role has no access', () => expect(canAccess(ROLES, 'nobody', MODULES.HOME)).toBe(false))
  test('no roles loaded', () => expect(canAccess([], 'dealer', MODULES.HOME)).toBe(false))
})

describe('getHomePath (landing page after sign-in)', () => {
  test('dealer lands on Home', () => expect(getHomePath(ROLES, 'dealer')).toBe(MODULE_PATHS[MODULES.HOME]))
  test('manufacturer lands on Order Approvals', () => expect(getHomePath(ROLES, 'manufacturer')).toBe(MODULE_PATHS[MODULES.ORDER_APPROVALS]))
  test('first allowed menu item when Home is not allowed', () => {
    const roles = [{ id: 'x', name: 'X', permissions: ['warranty', 'inventory'] }]
    expect(getHomePath(roles, 'x')).toBe(MODULE_PATHS[MODULES.INVENTORY]) // Inventory comes before Warranty in the menu
  })
  test('role with no permissions goes to Unauthorized', () => {
    expect(getHomePath([{ id: 'x', name: 'X', permissions: [] }], 'x')).toBe(PUBLIC_PATHS.UNAUTHORIZED)
  })
})
