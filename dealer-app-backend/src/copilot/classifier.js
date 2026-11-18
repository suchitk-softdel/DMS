// Naive Bayes text classifier, written in-house (no ML library).
//
// It learns from example questions (trainingData.js) which words point to
// which topic, so it also understands wordings it has never seen, e.g.
// "how much money came in" -> revenue. It returns a confidence per topic, so
// the Copilot knows when it is unsure and can ask back instead of guessing.

import { tokenize } from './text.js'
import { STOP_WORDS } from './vocabulary.js'

// Filler words ("how", "many", "are", "there", "in", ...) are ignored, so the
// model can only be confident because of real topic words. A question like
// "how many roles are there in the database" then gives no prediction at all
// instead of a confident wrong guess.
const contentWords = (text) => tokenize(text).filter((word) => !STOP_WORDS.has(word))

export function train(examplesByIntent) {
  const intents = {}
  const vocabulary = new Set()
  let totalExamples = 0

  for (const [intent, examples] of Object.entries(examplesByIntent)) {
    const counts = new Map()
    let wordTotal = 0
    for (const example of examples) {
      for (const word of contentWords(example)) {
        counts.set(word, (counts.get(word) ?? 0) + 1)
        wordTotal += 1
        vocabulary.add(word)
      }
    }
    intents[intent] = { counts, wordTotal, exampleCount: examples.length }
    totalExamples += examples.length
  }
  return { intents, vocabulary, totalExamples }
}

// -> [{ intent, confidence }] best first; confidences add up to 1.
// Words the model has never seen are ignored, so they can't skew the result.
export function predict(model, text) {
  const words = contentWords(text).filter((word) => model.vocabulary.has(word))
  if (words.length === 0) return []

  const vocabularySize = model.vocabulary.size
  const logScores = Object.entries(model.intents).map(([intent, data]) => {
    let score = Math.log(data.exampleCount / model.totalExamples)
    for (const word of words) {
      // Laplace smoothing: an unseen word lowers the score but never zeroes it.
      score += Math.log(((data.counts.get(word) ?? 0) + 1) / (data.wordTotal + vocabularySize))
    }
    return [intent, score]
  })

  const max = Math.max(...logScores.map(([, score]) => score))
  const weights = logScores.map(([intent, score]) => [intent, Math.exp(score - max)])
  const sum = weights.reduce((total, [, weight]) => total + weight, 0)
  return weights
    .map(([intent, weight]) => ({ intent, confidence: weight / sum }))
    .sort((a, b) => b.confidence - a.confidence)
}
