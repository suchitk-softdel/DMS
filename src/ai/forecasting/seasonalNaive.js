/**
 * Seasonal naive forecast (baseline model).
 *
 * TODO: Predict each future period as the value from the same period one
 * season earlier (e.g. next November = last November), optionally scaled by
 * the recent year-over-year growth. Used as the baseline that other models
 * must beat in backtesting.
 *
 * @param {number[]} _series   Monthly quantities, oldest first.
 * @param {{ seasonLength?: number, horizon?: number }} [_options]
 *   seasonLength defaults to 12 (monthly data); horizon = periods to forecast.
 * @returns {number[]} Forecast values, one per future period.
 */
export function seasonalNaiveForecast(_series, _options = {}) {
  return []
}
