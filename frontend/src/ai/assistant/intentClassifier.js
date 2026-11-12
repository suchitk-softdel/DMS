/**
 * Intent classifier for the in-app Q&A assistant (no external AI services).
 *
 * TODO: Train a lightweight model (e.g. multinomial Naive Bayes or TF-IDF +
 * cosine similarity) on getTrainingPhrases() and classify tokenized questions
 * into intents such as salesTotal, profitByDealer, claimsCount and orderStatus.
 * Return 'unknown' when confidence is below a threshold.
 *
 * @param {string[]} _tokens  Output of tokenize().
 * @returns {{ intent: string, confidence: number }}
 */
export function classifyIntent(_tokens) {
  return { intent: 'unknown', confidence: 0 }
}
