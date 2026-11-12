/**
 * Holt-Winters (triple exponential smoothing) forecast.
 *
 * TODO: Implement additive (or multiplicative) Holt-Winters with level,
 * trend and seasonal components. Initialise from the first full seasons,
 * then smooth with alpha/beta/gamma. Optionally grid-search the parameters
 * to minimise backtest error. Used to forecast each dealer's November and
 * December demand.
 *
 * @param {number[]} _series   Monthly quantities, oldest first (needs at least 2 seasons).
 * @param {{ seasonLength?: number, horizon?: number, alpha?: number, beta?: number, gamma?: number }} [_options]
 * @returns {number[]} Forecast values, one per future period.
 */
export function holtWintersForecast(_series, _options = {}) {
  return []
}
