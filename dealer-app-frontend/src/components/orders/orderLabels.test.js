import { describe, expect, test } from 'vitest'
import { hasPrices, NEXT_STEP, statusLabel, STEPS } from '@/components/orders/orderLabels'

describe('statusLabel', () => {
  test.each([
    ['submitted', 'Requested'],
    ['approved', 'Quoted'],
    ['accepted', 'Accepted'],
    ['declined', 'Declined'],
    ['draft', 'Draft'],
    ['rejected', 'Rejected'],
    ['fulfilled', 'Fulfilled'],
  ])('%s -> %s', (status, label) => expect(statusLabel('order', status)).toBe(label))

  test('unknown status falls back to the raw value', () => expect(statusLabel('order', 'weird')).toBe('weird'))
})

describe('hasPrices (prices appear once the manufacturer quotes)', () => {
  test.each(['approved', 'accepted', 'declined', 'fulfilled'])('%s has prices', (status) => expect(hasPrices({ status })).toBe(true))
  test.each(['draft', 'submitted', 'rejected'])('%s has no prices', (status) => expect(hasPrices({ status })).toBe(false))
})

describe('order flow', () => {
  test('dealer next steps', () => {
    expect(NEXT_STEP.draft.status).toBe('submitted')
    expect(NEXT_STEP.accepted.status).toBe('fulfilled')
    expect(NEXT_STEP.submitted).toBeUndefined() // waiting for the manufacturer
  })
  test('steps in order', () => expect(STEPS).toEqual(['draft', 'submitted', 'approved', 'accepted', 'fulfilled']))
})
