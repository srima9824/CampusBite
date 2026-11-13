import { describe, expect, it } from 'vitest'
import { roundMoney, subtotal } from './cartTotals.js'

describe('subtotal', () => {
  it('is zero for an empty cart', () => {
    expect(subtotal([])).toBe(0)
  })

  it('sums unit price times quantity across many lines', () => {
    const lines = [
      { unit_price: 80, quantity: 2 },
      { unit_price: 40, quantity: 1 },
      { unit_price: 110, quantity: 3 },
    ]

    expect(subtotal(lines)).toBe(530)
  })

  it('rounds away floating point noise on decimal prices', () => {
    expect(subtotal([{ unit_price: 0.1, quantity: 3 }])).toBe(0.3)
  })
})

describe('roundMoney', () => {
  it('rounds to two decimals', () => {
    expect(roundMoney(10.126)).toBe(10.13)
  })
})
