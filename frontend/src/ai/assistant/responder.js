/**
 * Responder for the in-app Q&A assistant.
 *
 * TODO: Turn a query result into a short natural-language answer using
 * per-intent templates, e.g. "Summit Comfort earned $412,300 profit in 2025,
 * up 8% on 2024." Format currency and numbers, and offer a fallback with
 * example questions when the intent is unknown or the result is empty.
 *
 * @param {string} _intent
 * @param {object} _entities
 * @param {object|null} _result  Output of runQuery().
 * @returns {string}
 */
export function composeResponse(_intent, _entities, _result) {
  return "I can't answer questions about the data yet. This feature is coming soon."
}
