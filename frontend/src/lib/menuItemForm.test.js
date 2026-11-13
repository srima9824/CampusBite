import { describe, expect, it } from 'vitest'
import { CATEGORY_MAX, DESCRIPTION_MAX, PRICE_MAX, validateMenuItem } from './menuItemForm.js'

const valid = { name: 'Test Dosa', description: 'Crisp', category: 'Dosas', price: '99.50' }

describe('validateMenuItem', () => {
  it('accepts a complete item with no errors', () => {
    expect(validateMenuItem(valid)).toEqual({})
  })

  it('accepts a number price and an omitted description', () => {
    expect(validateMenuItem({ ...valid, price: 80, description: undefined })).toEqual({})
  })

  it.each(['', ' ', 'A', '  A  ', 'x'.repeat(81)])('rejects the name %j', (name) => {
    expect(validateMenuItem({ ...valid, name })).toEqual({ name: expect.stringMatching(/name of 2 to 80/) })
  })

  it('accepts names of exactly 2 and 80 characters', () => {
    expect(validateMenuItem({ ...valid, name: 'Ab' })).toEqual({})
    expect(validateMenuItem({ ...valid, name: 'x'.repeat(80) })).toEqual({})
  })

  it('rejects a description over the limit and accepts one at the limit', () => {
    expect(validateMenuItem({ ...valid, description: 'x'.repeat(DESCRIPTION_MAX + 1) })).toHaveProperty('description')
    expect(validateMenuItem({ ...valid, description: 'x'.repeat(DESCRIPTION_MAX) })).toEqual({})
  })

  it('asks for a category when blank', () => {
    expect(validateMenuItem({ ...valid, category: '  ' }).category).toMatch(/Pick a category/)
  })

  it('rejects a category over the limit', () => {
    expect(validateMenuItem({ ...valid, category: 'x'.repeat(CATEGORY_MAX + 1) }).category).toMatch(/40 characters/)
  })

  it.each(['', 'abc', '0', '0.00', '-5', '1.234', '1e3', '10000.01', `${PRICE_MAX + 1}`])('rejects the price %j', (price) => {
    expect(validateMenuItem({ ...valid, price })).toEqual({ price: expect.stringMatching(/price above 0/) })
  })

  it.each(['0.01', '1', '99.5', '10000'])('accepts the price %s', (price) => {
    expect(validateMenuItem({ ...valid, price })).toEqual({})
  })

  it('reports every bad field at once', () => {
    expect(Object.keys(validateMenuItem({ name: '', description: '', category: '', price: '' })).sort()).toEqual([
      'category',
      'name',
      'price',
    ])
  })
})
