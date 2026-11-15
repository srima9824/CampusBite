import { describe, expect, it } from 'vitest'
import { ratingText } from './rating.js'

describe('ratingText', () => {
  it('shows nothing until a restaurant has reviews', () => {
    expect(ratingText({ average_rating: null, review_count: 0 })).toBeNull()
  })

  it('shows one decimal and the number of reviews', () => {
    expect(ratingText({ average_rating: 4.5, review_count: 1 })).toBe('4.5 (1 review)')
    expect(ratingText({ average_rating: 4, review_count: 12 })).toBe('4.0 (12 reviews)')
  })
})
