import { badRequest } from './httpError.js'

// Small helpers for reading and checking query-string values.

export function optionalEnum(value, allowed, name) {
  if (value === undefined || value === '') return undefined
  if (!allowed.includes(value)) {
    throw badRequest(`Invalid ${name}. Allowed values: ${allowed.join(', ')}.`)
  }
  return value
}

export function intInRange(value, { min, max, fallback, name }) {
  if (value === undefined || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw badRequest(`${name} must be a whole number between ${min} and ${max}.`)
  }
  return number
}

export function optionalMonth(value, name) {
  if (value === undefined || value === '') return undefined
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw badRequest(`${name} must look like YYYY-MM.`)
  return value
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const daysSince = (date, now = new Date()) => Math.max(0, Math.floor((now - date) / DAY_MS))
