/**
 * Backtest a forecasting function against held-out history.
 *
 * TODO: Hold out the last `holdout` periods (e.g. last year's Nov–Dec),
 * fit `forecastFn` on the rest, and compare predictions with the actual values.
 * Return error metrics (MAE, MAPE, RMSE) so the Forecasting page can show
 * accuracy and pick the best model per dealer.
 *
 * @param {number[]} _series
 * @param {(series: number[], options: object) => number[]} _forecastFn
 * @param {{ holdout?: number, seasonLength?: number }} [_options]
 * @returns {{ mae: number|null, mape: number|null, rmse: number|null, predictions: number[], actuals: number[] }}
 */
export function backtest(_series, _forecastFn, _options = {}) {
  return { mae: null, mape: null, rmse: null, predictions: [], actuals: [] }
}
