import { formatCurrency, formatDayMonth } from '@/lib/format'

// How each activity event from the backend reads and the color of its dot.
// Shared by Home (Recent Activity) and Dealer 360 (Dealer Timeline).
const ACTIVITY = {
  order: { color: 'primary.main', text: (e) => `Order ${formatCurrency(e.amount, { compact: true })} placed` },
  claimSubmitted: { color: 'warning.main', text: () => 'Claim submitted' },
  claimResolved: { color: 'brand.tealDark', text: (e) => `Claim ${e.stage}` },
}

// events: [{ date, type, ref, amount, stage? }] -> ActivityTimeline items
export function toTimelineItems(events = []) {
  return events.map((event, index) => ({
    key: `${event.type}-${event.ref}-${index}`,
    date: formatDayMonth(event.date),
    text: ACTIVITY[event.type]?.text(event) ?? event.type,
    detail: event.ref,
    color: ACTIVITY[event.type]?.color,
  }))
}
