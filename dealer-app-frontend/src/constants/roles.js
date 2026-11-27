// The two login roles of the Dealer App: a dealer (every dealer screen) and
// the manufacturer (Order Approvals, Order Details, Claim Insights).
// The Manufacturer Administrator works in separate admin tooling and the
// AI Copilot is a system actor, so neither is a login role here.
export const ROLES = Object.freeze({
  DEALER: 'dealer',
  MANUFACTURER: 'manufacturer',
})
