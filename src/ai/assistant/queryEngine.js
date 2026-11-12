/**
 * Query engine for the in-app Q&A assistant.
 *
 * TODO: Map each intent to a calculation over the data loaded through
 * services/dataService.js: filter by the extracted entities, then aggregate
 * (sum, average, count, group-by dealer/product/month, top-N). For example,
 * profitByDealer = Σ(revenue − cost) grouped by dealer for the period.
 * Respect the user's role: dealer users only see their own dealer's data.
 *
 * @param {string} _intent
 * @param {object} _entities  Output of extractEntities().
 * @param {{ sales?: object[], orders?: object[], claims?: object[], dealers?: object[], products?: object[] }} _data
 * @returns {{ value: number|null, rows: object[], unit: string|null } | null}
 */
export function runQuery(_intent, _entities, _data) {
  return null
}
