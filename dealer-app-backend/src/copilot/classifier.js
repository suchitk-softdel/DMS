// Naive Bayes text classifier, written in-house (no ML library).
//
// It learns from example questions (trainingData.js) which words point to
// which topic, so it also understands wordings it has never seen, e.g.
// "how much money came in" -> revenue. It returns a confidence per topic, so
// the Copilot knows when it is unsure and can ask back instead of guessing.
//
// Two steps:
//   train()   - runs ONCE when the server starts: counts which words appear in
//               the example questions of each topic.
//   predict() - runs for EVERY question: uses those counts to score each topic
//               and returns them best first, with a confidence (0..1).

import { tokenize } from './text.js'
import { STOP_WORDS } from './vocabulary.js'

// Splits a question into words and drops filler words.
// "how many furnaces did I sell" -> ["furnaces", "sell"]
//
// Filler words ("how", "many", "are", "there", "in", ...) are ignored, so the
// model can only be confident because of real topic words. A question like
// "how many roles are there in the database" then gives no prediction at all
// instead of a confident wrong guess.
const contentWords = (text) => tokenize(text).filter((word) => !STOP_WORDS.has(word))

// TRAINING: learns from the example questions in trainingData.js.
// examplesByIntent = { revenue: ['total revenue this year', ...], profit: [...], ... }
//
// For each topic it counts how often every word appears, e.g.
//   revenue: { sales: 8, revenue: 3, money: 2, ... }
//   profit:  { profit: 6, margin: 3, earn: 2, ... }
// -> model = { intents: { topic: { counts, wordTotal, exampleCount } }, vocabulary, totalExamples }
export function train(examplesByIntent) {
  const intents = {} // word counts per topic
  const vocabulary = new Set() // every word seen in any example
  let totalExamples = 0 // number of examples over all topics

  // Go through each topic and its example questions.
  for (const [intent, examples] of Object.entries(examplesByIntent)) {
    const counts = new Map() // word -> how many times it appears in this topic
    let wordTotal = 0 // total words in this topic's examples
    for (const example of examples) {
      for (const word of contentWords(example)) {
        counts.set(word, (counts.get(word) ?? 0) + 1) // count the word for this topic
        wordTotal += 1
        vocabulary.add(word) // remember the word
      }
    }
    // Save what was learned for this topic.
    intents[intent] = { counts, wordTotal, exampleCount: examples.length }
    totalExamples += examples.length
  }
  return { intents, vocabulary, totalExamples }
}

// PREDICTION: guesses the topic of a new question.
// predict(model, "how much money came in") ->
//   [{ intent: 'revenue', confidence: 0.82 }, { intent: 'profit', confidence: 0.10 }, ...]
//
// -> [{ intent, confidence }] best first; confidences add up to 1.
// Words the model has never seen are ignored, so they can't skew the result.
export function predict(model, text) {
  // Keep only real words the model learned during training.
  const words = contentWords(text).filter((word) => model.vocabulary.has(word))
  // No known words at all -> no guess (the Copilot then says it can't answer).
  if (words.length === 0) return []

  const vocabularySize = model.vocabulary.size

  // Score every topic: how likely is this question to belong to it?
  // Naive Bayes: score = P(topic) x P(word1 | topic) x P(word2 | topic) x ...
  // Logarithms are used so many small numbers can be added instead of
  // multiplied (multiplying them would round down to 0).
  const logScores = Object.entries(model.intents).map(([intent, data]) => {
    // P(topic): topics with more examples are a little more likely.
    let score = Math.log(data.exampleCount / model.totalExamples)
    for (const word of words) {
      // P(word | topic): how often this word appeared in the topic's examples.
      // Laplace smoothing (+1): an unseen word lowers the score but never zeroes it.
      score += Math.log(((data.counts.get(word) ?? 0) + 1) / (data.wordTotal + vocabularySize))
    }
    return [intent, score]
  })

  // Turn the scores into confidences that add up to 1 (100%).
  // Subtracting the highest score first keeps the numbers in a safe range.
  const max = Math.max(...logScores.map(([, score]) => score))
  const weights = logScores.map(([intent, score]) => [intent, Math.exp(score - max)])
  const sum = weights.reduce((total, [, weight]) => total + weight, 0)

  // Best topic first, e.g. revenue 82%, profit 10%, units 8%.
  return weights
    .map(([intent, weight]) => ({ intent, confidence: weight / sum }))
    .sort((a, b) => b.confidence - a.confidence)
}
