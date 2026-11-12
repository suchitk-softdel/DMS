// Shared display formatting so tiles, tables, charts and the assistant all
// show values the same way. Missing values render as an em dash.

const LOCALE = 'en-US'
const CURRENCY = 'USD'
export const EMPTY_VALUE = '—'

const isMissing = (value) => value === null || value === undefined || Number.isNaN(Number(value))

export function formatNumber(value, { decimals = 0, compact = false } = {}) {
  if (isMissing(value)) return EMPTY_VALUE
  return new Intl.NumberFormat(LOCALE, {
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 1 : decimals,
  }).format(Number(value))
}

// formatCurrency(1840000) -> "$1,840,000"; with { compact: true } -> "$1.8M"
export function formatCurrency(value, { decimals = 0, compact = false } = {}) {
  if (isMissing(value)) return EMPTY_VALUE
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    notation: compact ? 'compact' : 'standard',
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 1 : decimals,
  }).format(Number(value))
}

// Takes a percentage (4.2 -> "4.2%"). Pass { fromRatio: true } for 0.042 -> "4.2%".
export function formatPercent(value, { decimals = 1, fromRatio = false, signed = false } = {}) {
  if (isMissing(value)) return EMPTY_VALUE
  const ratio = fromRatio ? Number(value) : Number(value) / 100
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(ratio)
}

// Accepts a Date, timestamp or ISO string. style: 'short' | 'medium' | 'long'.
export function formatDate(value, { style = 'medium' } = {}) {
  if (!value) return EMPTY_VALUE
  // Read 'YYYY-MM-DD' as a local date; new Date() would treat it as UTC
  // midnight and show the previous day in timezones west of UTC.
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = value instanceof Date ? value : new Date(dateOnly ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: style }).format(date)
}
