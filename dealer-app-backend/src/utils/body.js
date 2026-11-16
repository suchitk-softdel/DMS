import { badRequest } from './httpError.js'

// Small helpers for checking JSON request bodies. Each returns the cleaned
// value or throws a 400 with a message the UI can show.

export function requiredEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw badRequest(`${name} must be one of: ${allowed.join(', ')}.`)
  return value
}

export function requiredString(value, name, { maxLength = 500 } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`${name} is required.`)
  if (value.trim().length > maxLength) throw badRequest(`${name} must be at most ${maxLength} characters.`)
  return value.trim()
}

export function requiredNumber(value, name, { min, max, integer = false }) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw badRequest(`${name} must be a ${integer ? 'whole number' : 'number'}.`)
  }
  if (value < min || value > max) throw badRequest(`${name} must be between ${min} and ${max}.`)
  return value
}

export function requiredArray(value, name, { minLength = 1, maxLength = 50 } = {}) {
  if (!Array.isArray(value) || value.length < minLength || value.length > maxLength) {
    throw badRequest(`${name} must be a list of ${minLength} to ${maxLength} entries.`)
  }
  return value
}
