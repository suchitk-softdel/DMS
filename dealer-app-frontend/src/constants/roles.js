// User classes that sign in to the Dealer App (SRS v1.0 section 2.3).
// The Manufacturer Administrator works in separate admin tooling and the
// AI Copilot is a system actor, so neither is a login role here.
export const ROLES = Object.freeze({
  PRINCIPAL: 'principal',
  SALES_REP: 'salesRep',
  TECHNICIAN: 'technician',
})
