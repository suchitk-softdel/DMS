import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { PUBLIC_PATHS } from '@/constants/modules'
import { NAV_ITEMS } from '@/lib/navigation'
import { selectCurrentUser } from '@/store/slices/authSlice'
import { selectRoles, selectRolesStatus } from '@/store/slices/rolesSlice'

export function getRole(roles, roleId) {
  return roles.find((role) => role.id === roleId) ?? null
}

export function canAccess(roles, roleId, moduleKey) {
  return Boolean(getRole(roles, roleId)?.permissions.includes(moduleKey))
}

// First menu item the role can open; falls back to /unauthorized if none.
export function getHomePath(roles, roleId) {
  const firstAllowed = NAV_ITEMS.find((item) => canAccess(roles, roleId, item.key))
  return firstAllowed?.path ?? PUBLIC_PATHS.UNAUTHORIZED
}

export function usePermissions() {
  const user = useSelector(selectCurrentUser)
  const roles = useSelector(selectRoles)
  const rolesStatus = useSelector(selectRolesStatus)

  return useMemo(() => {
    const roleId = user?.roleId
    return {
      user,
      roles,
      rolesStatus,
      role: getRole(roles, roleId),
      can: (moduleKey) => canAccess(roles, roleId, moduleKey),
      homePath: getHomePath(roles, roleId),
    }
  }, [user, roles, rolesStatus])
}
