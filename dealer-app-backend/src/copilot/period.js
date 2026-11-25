// Turns time words in a question into an exact date range.
// A period is { from, to, label, kind }; `to` is exclusive.

// One day in milliseconds.
const DAY_MS = 24 * 60 * 60 * 1000
// Month names the user may type, full and short ("march", "mar").
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// Number words, so "last six months" works like "last 6 months".
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

// utc(2025, 2, 1) -> 1 Mar 2025 (UTC, so time zones never shift a date).
const utc = (y, m = 0, d = 1) => new Date(Date.UTC(y, m, d))
// The same date at 00:00.
const startOfDay = (date) => utc(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
// monthName(2) -> "March"
const monthName = (m) => MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)
// fmtDay(date) -> "19 Nov 2026"
const fmtDay = (date) => `${date.getUTCDate()} ${monthName(date.getUTCMonth()).slice(0, 3)} ${date.getUTCFullYear()}`

// Ready-made periods:
// calendarYear(2025) -> 1 Jan 2025 – 31 Dec 2025, label "2025"
const calendarYear = (y) => ({ from: utc(y), to: utc(y + 1), label: String(y), kind: 'year' })
// calendarMonth(2025, 6) -> 1 Jul – 31 Jul 2025, label "July 2025"
const calendarMonth = (y, m) => ({ from: utc(y, m), to: utc(y, m + 1), label: `${monthName(m)} ${y}`, kind: 'month' })
// quarter(2025, 3) -> 1 Jul – 30 Sep 2025, label "Q3 2025"
const quarter = (y, q) => ({ from: utc(y, (q - 1) * 3), to: utc(y, q * 3), label: `Q${q} ${y}`, kind: 'quarter' })

// "all time", "ever", "overall": every record up to today.
export function allTime(today) {
  return { from: utc(2000), to: new Date(startOfDay(today).getTime() + DAY_MS), label: 'all time', kind: 'all' }
}

// "this year": 1 Jan of this year up to today, label "2026 so far".
// Also the default when a question has no time words.
export function yearToDate(today) {
  const y = today.getUTCFullYear()
  return { from: utc(y), to: new Date(startOfDay(today).getTime() + DAY_MS), label: `${y} so far`, kind: 'ytd' }
}

// MAIN FUNCTION: finds time words in the question and returns the exact dates.
// Checks the most specific phrases first. Examples (today = 20 Nov 2026):
//   "last year"     -> 2025
//   "this month"    -> 1 Nov 2026 – today
//   "last 6 months" -> 1 Jun 2026 – today
//   "q3 2025"       -> 1 Jul – 30 Sep 2025
//   "march"         -> March 2026 (or 2025 if March is still to come)
//   "2024"          -> 2024
// -> period, or null when the question has no time words.
export function extractPeriod(text, today) {
  // Today's year and month; `tomorrow` is the end of a range that includes today.
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const tomorrow = new Date(startOfDay(today).getTime() + DAY_MS)

  // "all time", "overall", "lifetime" (but not "year to date")
  if (/ (all time|ever|overall|since the beginning|in total|lifetime|till date|to date) /.test(text) && !/ year to date /.test(text)) {
    return allTime(today)
  }

  // Rolling periods: "last 6 months", "past 90 days", "previous two years".
  // Months and years start on the 1st (last 6 months = 1 Jun – today).
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

  // "last year", "previous financial year" -> the whole previous calendar year
  if (/ (last|previous|past|prior) (financial |fiscal |calendar )?year /.test(text)) return calendarYear(y - 1)
  // "this year", "ytd", "year to date" -> 1 Jan up to today
  if (/ (this|current) (financial |fiscal |calendar )?year | ytd | year to date | so far this year /.test(text)) return yearToDate(today)
  // "last month" -> the whole previous calendar month (Dec of last year in January)
  if (/ (last|previous|past) month /.test(text)) return calendarMonth(m === 0 ? y - 1 : y, (m + 11) % 12)
  // "this month", "mtd" -> 1st of this month up to today
  if (/ (this|current) month | mtd | month to date /.test(text)) {
    return { from: utc(y, m), to: tomorrow, label: `${monthName(m)} ${y} so far`, kind: 'mtd' }
  }

  // Which quarter today is in (1-4).
  const currentQuarter = Math.floor(m / 3) + 1
  // "last quarter" -> the previous quarter (Q4 of last year when we are in Q1)
  if (/ (last|previous) quarter /.test(text)) return currentQuarter === 1 ? quarter(y - 1, 4) : quarter(y, currentQuarter - 1)
  // "this quarter", "qtd" -> start of this quarter up to today
  if (/ (this|current) quarter | qtd /.test(text)) {
    return { from: utc(y, (currentQuarter - 1) * 3), to: tomorrow, label: `Q${currentQuarter} ${y} so far`, kind: 'qtd' }
  }

  // "last week" -> the 7 days before the last 7 days
  if (/ (last|previous|past) week /.test(text)) {
    return { from: new Date(tomorrow.getTime() - 14 * DAY_MS), to: new Date(tomorrow.getTime() - 7 * DAY_MS), label: 'last week', kind: 'week' }
  }
  // "this week" -> the last 7 days
  if (/ (this|current) week /.test(text)) return { from: new Date(tomorrow.getTime() - 7 * DAY_MS), to: tomorrow, label: 'the last 7 days', kind: 'week' }
  // "yesterday" -> that one day
  if (/ yesterday /.test(text)) {
    const from = new Date(startOfDay(today).getTime() - DAY_MS)
    return { from, to: startOfDay(today), label: `yesterday (${fmtDay(from)})`, kind: 'day' }
  }
  // "today" -> today only
  if (/ today /.test(text)) return { from: startOfDay(today), to: tomorrow, label: 'today', kind: 'day' }

  // "q3", "q3 2025", "quarter 3". With no year: this year, or last year if that
  // quarter has not started yet.
  const q = text.match(/ (?:q|quarter )([1-4])(?: (20\d\d))? /)
  if (q) {
    const qn = Number(q[1])
    const qy = q[2] ? Number(q[2]) : qn > currentQuarter ? y - 1 : y
    return quarter(qy, qn)
  }

  // "march", "march 2025", "nov 2025". With no year: this year, or last year if
  // that month is still to come. ("may i see..." is not the month of May.)
  for (let i = 0; i < 12; i += 1) {
    const match = text.match(new RegExp(` (?:${MONTHS[i]}|${MONTH_SHORT[i]})(?: (20\\d\\d))? `))
    if (match && !(MONTH_SHORT[i] === 'may' && !match[1] && / may (i|we|you) /.test(text))) {
      const my = match[1] ? Number(match[1]) : i > m ? y - 1 : y
      return calendarMonth(my, i)
    }
  }

  // A plain year: "2025", "in 2024" -> that whole year
  const year = text.match(/ (20\d\d) /)
  if (year) return calendarYear(Number(year[1]))

  // No time words found: the parser then uses its default (this year so far).
  return null
}

// "compare with last year": the same period one year earlier.
// 2025 -> 2024, July 2025 -> July 2024, Q3 2025 -> Q3 2024.
// For "2026 so far" it is the same days of 2025, so seasons line up.
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

// The periods offered in the Copilot's period filter (the chip under an
// answer). value is what the client sends back to re-run the answer.
export function periodChoices(today) {
  return [
    { value: 'ytd', period: yearToDate(today) },
    { value: 'lastYear', period: extractPeriod(' last year ', today) },
    { value: 'last12', period: extractPeriod(' last 12 months ', today) },
    { value: 'thisQuarter', period: extractPeriod(' this quarter ', today) },
    { value: 'lastQuarter', period: extractPeriod(' last quarter ', today) },
    { value: 'all', period: allTime(today) },
  ]
}

// monthKey(date) -> "2025-07", used to group records by month.
export const monthKey = (date) => date.toISOString().slice(0, 7)
// monthLabel("2025-07") -> "Jul 2025", the label shown in month charts and tables.
export const monthLabel = (key) => `${monthName(Number(key.slice(5, 7)) - 1).slice(0, 3)} ${key.slice(0, 4)}`
