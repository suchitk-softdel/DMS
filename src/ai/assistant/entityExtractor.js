/**
 * Entity extractor for the in-app Q&A assistant.
 *
 * TODO: Pull structured parameters out of the question using dictionaries
 * and regexes: dealer (match names/ids from the dealer list), product/category,
 * time period ("last year", "Q3", "November 2025", "this month"), metric
 * (sales, profit, units, claims) and ranking hints ("top 5", "lowest").
 *
 * @param {string} _text  The user's question.
 * @param {{ dealers?: object[], products?: object[] }} [_context]  Lookup data for names.
 * @returns {{ dealerId: string|null, productId: string|null, period: { from: string, to: string }|null, metric: string|null, limit: number|null }}
 */
export function extractEntities(_text, _context = {}) {
  return { dealerId: null, productId: null, period: null, metric: null, limit: null }
}
