export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANUFACTURER: 'manufacturer',
  PRINCIPAL: 'principal',
  SALES_REP: 'salesRep',
  TECHNICIAN: 'technician',
})

// Roles that belong to a dealership (as opposed to manufacturer staff).
export const DEALER_ROLES = Object.freeze([ROLES.PRINCIPAL, ROLES.SALES_REP, ROLES.TECHNICIAN])

export const isDealerRole = (roleId) => DEALER_ROLES.includes(roleId)
