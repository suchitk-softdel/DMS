// Turns time words in a question into an exact date range.
// A period is { from, to, label, kind }; `to` is exclusive.

const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

const utc = (y, m = 0, d = 1) => new Date(Date.UTC(y, m, d))
const startOfDay = (date) => utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
const monthName = (m) => MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)
const fmtDay = (date) => `${date.getUTCDate()} ${monthName(date.getUTCMonth()).slice(0, 3)} ${date.getUTCFullYear()}`

const calendarYear = (y) => ({ from: utc(y), to: utc(y + 1), label: String(y), kind: 'year' })
const calendarMonth = (y, m) => ({ from: utc(y, m), to: utc(y, m + 1), label: `${monthName(m)} ${y}`, kind: 'month' })
const quarter = (y, q) => ({ from: utc(y, (q - 1) * 3), to: utc(y, q * 3), label: `Q${q} ${y}`, kind: 'quarter' })

export function allTime(today) {
  return { from: utc(2000), to: new Date(startOfDay(today).getTime() + DAY_MS), label: 'all time', kind: 'all' }
}

export function yearToDate(today) {
  const y = today.getUTCFullYear()
  return { from: utc(y), to: new Date(startOfDay(today).getTime() + DAY_MS), label: `${y} so far`, kind: 'ytd' }
}

// -> period, or null when the question has no time words.
export function extractPeriod(text, today) {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const tomorrow = new Date(startOfDay(today).getTime() + DAY_MS)

  if (/ (all time|ever|overall|since the beginning|in total|lifetime|till date|to date) /.test(text) && !/ year to date /.test(text)) {
    return allTime(today)
  }

  // "last 6 months", "past 90 days", "previous two years"
  const rolling = text.match(/ (?:last|past|previous) (\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) (day|days|week|weeks|month|months|year|years) /)
  if (rolling) {
    const n = Number(rolling[1]) || NUMBER_WORDS[rolling[1]]
    const unit = rolling[2].replace(/s$/, '')
    const from =
      unit === 'day' ? new Date(tomorrow.getTime() - n * DAY_MS)
      : unit === 'week' ? new Date(tomorrow.getTime() - n * 7 * DAY_MS)
      : unit === 'month' ? utc(y, m - n + 1)
      : utc(y - n + 1)
    const label = `last ${n} ${unit}${n === 1 ? '' : 's'}`
    return { from, to: tomorrow, label, kind: 'rolling' }
  }

  if (/ (last|previous|past|prior) (financial |fiscal |calendar )?year /.test(text)) return calendarYear(y - 1)
  if (/ (this|current) (financial |fiscal |calendar )?year | ytd | year to date | so far this year /.test(text)) return yearToDate(today)
  if (/ (last|previous|past) month /.test(text)) return calendarMonth(m === 0 ? y - 1 : y, (m + 11) % 12)
  if (/ (this|current) month | mtd | month to date /.test(text)) {
    return { from: utc(y, m), to: tomorrow, label: `${monthName(m)} ${y} so far`, kind: 'mtd' }
  }

  const currentQuarter = Math.floor(m / 3) + 1
  if (/ (last|previous) quarter /.test(text)) return currentQuarter === 1 ? quarter(y - 1, 4) : quarter(y, currentQuarter - 1)
  if (/ (this|current) quarter | qtd /.test(text)) {
    return { from: utc(y, (currentQuarter - 1) * 3), to: tomorrow, label: `Q${currentQuarter} ${y} so far`, kind: 'qtd' }
  }

  if (/ (last|previous|past) week /.test(text)) {
    return { from: new Date(tomorrow.getTime() - 14 * DAY_MS), to: new Date(tomorrow.getTime() - 7 * DAY_MS), label: 'last week', kind: 'week' }
  }
  if (/ (this|current) week /.test(text)) return { from: new Date(tomorrow.getTime() - 7 * DAY_MS), to: tomorrow, label: 'the last 7 days', kind: 'week' }
  if (/ yesterday /.test(text)) {
    const from = new Date(startOfDay(today).getTime() - DAY_MS)
    return { from, to: startOfDay(today), label: `yesterday (${fmtDay(from)})`, kind: 'day' }
  }
  if (/ today /.test(text)) return { from: startOfDay(today), to: tomorrow, label: 'today', kind: 'day' }

  // "q3", "q3 2025", "quarter 3"
  const q = text.match(/ (?:q|quarter )([1-4])(?: (20\d\d))? /)
  if (q) {
    const qn = Number(q[1])
    const qy = q[2] ? Number(q[2]) : qn > currentQuarter ? y - 1 : y
    return quarter(qy, qn)
  }

  // "march", "march 2025", "nov 2025"
  for (let i = 0; i < 12; i += 1) {
    const match = text.match(new RegExp(` (?:${MONTHS[i]}|${MONTH_SHORT[i]})(?: (20\\d\\d))? `))
    if (match && !(MONTH_SHORT[i] === 'may' && !match[1] && / may (i|we|you) /.test(text))) {
      const my = match[1] ? Number(match[1]) : i > m ? y - 1 : y
      return calendarMonth(my, i)
    }
  }

  // "2025", "in 2024"
  const year = text.match(/ (20\d\d) /)
  if (year) return calendarYear(Number(year[1]))

  return null
}

// The same period one year earlier (used for "compare", "growth"). For
// "2026 so far" this is the same days of 2025, so seasons line up.
export function previousYear(period) {
  const shift = (date) => utc(date.getUTCFullYear() - 1, date.getUTCMonth(), date.getUTCDate())
  const from = shift(period.from)
  const to = shift(period.to)
  const label =
    period.kind === 'year' ? String(from.getUTCFullYear())
    : period.kind === 'month' ? calendarMonth(from.getUTCFullYear(), from.getUTCMonth()).label
    : period.kind === 'quarter' ? period.label.replace(/\d{4}$/, String(from.getUTCFullYear()))
    : `the same period in ${from.getUTCFullYear()}`
  return { from, to, label, kind: period.kind }
}

export const monthKey = (date) => date.toISOString().slice(0, 7)
export const monthLabel = (key) => `${monthName(Number(key.slice(5, 7)) - 1).slice(0, 3)} ${key.slice(0, 4)}`
