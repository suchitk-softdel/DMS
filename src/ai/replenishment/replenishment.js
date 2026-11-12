/**
 * Replenishment suggestions from a demand forecast.
 *
 * TODO: For each dealer and product, compute
 *   suggested = forecast demand + safety stock − on hand − on order
 * where safety stock is derived from forecast error (e.g. z × σ × √leadTime).
 * Clamp at zero, round up to the case pack / minimum order quantity, and
 * include a short explanation for each suggestion.
 *
 * @param {{
 *   forecast: Array<{ dealerId: string, productId: string, period: string, quantity: number }>,
 *   inventory?: Array<{ dealerId: string, productId: string, onHand: number, onOrder: number }>,
 *   serviceLevel?: number,
 *   leadTimeMonths?: number,
 * }} _input
 * @returns {Array<{ dealerId: string, productId: string, suggestedQuantity: number, reason: string }>}
 */
export function suggestOrderQuantities(_input) {
  return []
}
