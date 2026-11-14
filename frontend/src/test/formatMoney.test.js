import { describe, expect, it } from 'vitest'
import { formatMoney } from '../lib/formatMoney.js'

describe('formatMoney', () => {
  it.each([
    [0, 'Rs. 0.00'],
    [80, 'Rs. 80.00'],
    [120.5, 'Rs. 120.50'],
    [99.999, 'Rs. 100.00'],
    [1234567.5, 'Rs. 12,34,567.50'],
  ])('formats %s as %s', (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected)
  })
})
