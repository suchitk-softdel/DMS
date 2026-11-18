// Text helpers: cleaning, word splitting and spelling correction.
// All written in-house (no NLP library).

// Common short forms, expanded before anything else reads the text.
const ABBREVIATIONS = {
  yr: 'year', yrs: 'years', mth: 'month', mths: 'months', qtr: 'quarter', qty: 'quantity', amt: 'amount',
  rev: 'revenue', cust: 'customer', custs: 'customers', prev: 'previous', thru: 'through',
}

export function normalize(text) {
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9/\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ` ${cleaned.split(' ').map((word) => ABBREVIATIONS[word] ?? word).join(' ')} `
}

export const tokenize = (text) => normalize(text).match(/[a-z0-9]+/g) ?? []

// Number of single-letter edits (insert, delete, replace, swap) between two words.
export function editDistance(a, b) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 3
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

// Replaces misspelled words with the closest known word, e.g. "sles" ->
// "sales", "climes" -> "claims". Short words and numbers are left alone.
export function correctSpelling(text, knownWords) {
  const corrections = []
  const words = tokenize(text).map((word) => {
    if (knownWords.has(word) || word.length < 4 || /\d/.test(word)) return word
    const maxEdits = word.length >= 7 ? 2 : 1
    let best = null
    let bestDistance = maxEdits + 1
    for (const known of knownWords) {
      if (known.length < 3) continue
      const distance = editDistance(word, known)
      if (distance < bestDistance) {
        best = known
        bestDistance = distance
      }
    }
    if (best) {
      corrections.push(`${word} → ${best}`)
      return best
    }
    return word
  })
  return { text: ` ${words.join(' ')} `, corrections }
}

// True when the normalized text contains the phrase as whole words.
export const hasPhrase = (text, phrase) => text.includes(` ${phrase} `)

export const hasAny = (text, phrases) => phrases.some((phrase) => hasPhrase(text, phrase))
