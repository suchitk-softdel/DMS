import { describe, expect, test } from 'vitest'
import { EMPTY_VALUE, formatCurrency, formatDate, formatDayMonth, formatNumber, formatPercent } from '@/lib/format'

describe('missing values show a dash, never NaN / undefined / null', () => {
  test.each([null, undefined, NaN, 'abc'])('%s', (value) => {
    expect(formatNumber(value)).toBe(EMPTY_VALUE)
    expect(formatCurrency(value)).toBe(EMPTY_VALUE)
    expect(formatPercent(value)).toBe(EMPTY_VALUE)
  })

  test.each([null, undefined, '', 'not a date'])('date %s', (value) => {
    expect(formatDate(value)).toBe(EMPTY_VALUE)
    expect(formatDayMonth(value)).toBe(EMPTY_VALUE)
  })
})

describe('formatNumber', () => {
  test('groups thousands', () => expect(formatNumber(1234567)).toBe('1,234,567'))
  test('zero is a value, not missing', () => expect(formatNumber(0)).toBe('0'))
  test('decimals', () => expect(formatNumber(3.14159, { decimals: 2 })).toBe('3.14'))
  test('compact', () => expect(formatNumber(1840000, { compact: true })).toBe('1.8M'))
  test('numeric strings', () => expect(formatNumber('42')).toBe('42'))
})

describe('formatCurrency', () => {
  test('whole dollars by default', () => expect(formatCurrency(1840000)).toBe('$1,840,000'))
  test('compact', () => expect(formatCurrency(1840000, { compact: true })).toBe('$1.8M'))
  test('cents', () => expect(formatCurrency(12.5, { decimals: 2 })).toBe('$12.50'))
  test('negative', () => expect(formatCurrency(-250)).toBe('-$250'))
})

describe('formatPercent', () => {
  test('takes a percentage', () => expect(formatPercent(4.2)).toBe('4.2%'))
  test('from a ratio', () => expect(formatPercent(0.042, { fromRatio: true })).toBe('4.2%'))
  test('signed', () => {
    expect(formatPercent(4.2, { signed: true })).toBe('+4.2%')
    expect(formatPercent(-4.2, { signed: true })).toBe('-4.2%')
    expect(formatPercent(0, { signed: true })).toBe('0.0%')
  })
})

describe('formatDate', () => {
  test('date-only strings keep their day in every timezone', () => {
    expect(formatDate('2026-11-01')).toBe('Nov 1, 2026')
  })
  test('Date objects', () => expect(formatDate(new Date(2026, 10, 25))).toBe('Nov 25, 2026'))
  test('styles', () => {
    expect(formatDate('2026-11-25', { style: 'short' })).toBe('11/25/26')
    expect(formatDate('2026-11-25', { style: 'long' })).toBe('November 25, 2026')
  })
})

describe('formatDayMonth', () => {
  test('day and short month', () => expect(formatDayMonth(new Date(2026, 9, 12))).toBe('12 Oct'))
})
