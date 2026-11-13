import { render, screen, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CartProvider, useCart } from './CartContext.jsx'

const STORAGE_KEY = 'campusbite.cart'
const dosaDash = { id: 1, name: 'Dosa Dash' }
const wokWorld = { id: 2, name: 'Wok World' }
const masala = { id: 1, name: 'Masala Dosa', price: 80 }
const coffee = { id: 6, name: 'Filter Coffee', price: 40 }
const noodles = { id: 8, name: 'Veg Hakka Noodles', price: 140 }

let cart
function Probe() {
  cart = useCart()
  return null
}

function mountCart() {
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  )
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY))
const quantityOf = (id) => cart.lines.find((line) => line.menu_item_id === id)?.quantity

describe('CartProvider', () => {
  it('starts empty', () => {
    mountCart()

    expect(cart.lines).toEqual([])
    expect(cart.itemCount).toBe(0)
    expect(cart.subtotal).toBe(0)
    expect(cart.restaurantId).toBeNull()
  })

  it('adds an item and remembers its restaurant', () => {
    mountCart()

    act(() => cart.addItem(masala, dosaDash))

    expect(cart.lines).toEqual([{ menu_item_id: 1, name: 'Masala Dosa', unit_price: 80, quantity: 1 }])
    expect(cart.restaurantId).toBe(1)
    expect(cart.restaurantName).toBe('Dosa Dash')
  })

  it('increments the quantity when the same item is added again', () => {
    mountCart()

    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.addItem(masala, dosaDash))

    expect(quantityOf(1)).toBe(2)
    expect(cart.lines).toHaveLength(1)
  })

  it('sets a quantity directly', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))

    act(() => cart.setQuantity(1, 7))

    expect(quantityOf(1)).toBe(7)
  })

  it('clamps the quantity at 20 when set above the limit', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))

    act(() => cart.setQuantity(1, 99))

    expect(quantityOf(1)).toBe(20)
  })

  it('does not grow past 20 by repeated adds', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.setQuantity(1, 20))

    act(() => cart.addItem(masala, dosaDash))

    expect(quantityOf(1)).toBe(20)
  })

  it('removes a line when its quantity is set to 0', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.addItem(coffee, dosaDash))

    act(() => cart.setQuantity(1, 0))

    expect(cart.lines.map((line) => line.menu_item_id)).toEqual([6])
  })

  it('removes an item with removeItem', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.addItem(coffee, dosaDash))

    act(() => cart.removeItem(6))

    expect(cart.lines.map((line) => line.menu_item_id)).toEqual([1])
  })

  it('forgets the restaurant once the last line is removed', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))

    act(() => cart.removeItem(1))

    expect(cart.restaurantId).toBeNull()
    expect(cart.lines).toEqual([])
  })

  it('ignores a quantity change for an item that is not in the cart', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))

    act(() => cart.setQuantity(99, 3))

    expect(cart.lines).toHaveLength(1)
  })

  it('reports a conflict and leaves the cart alone when adding from another restaurant', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    let result

    act(() => {
      result = cart.addItem(noodles, wokWorld)
    })

    expect(result).toEqual({ conflict: true })
    expect(cart.lines.map((line) => line.menu_item_id)).toEqual([1])
    expect(cart.restaurantName).toBe('Dosa Dash')
  })

  it('reports no conflict when adding from the same restaurant', () => {
    mountCart()
    let result

    act(() => {
      result = cart.addItem(masala, dosaDash)
    })

    expect(result).toEqual({ conflict: false })
  })

  it('replaces the whole cart with one item from another restaurant', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.addItem(coffee, dosaDash))

    act(() => cart.replaceWith(noodles, wokWorld))

    expect(cart.lines.map((line) => line.menu_item_id)).toEqual([8])
    expect(cart.restaurantId).toBe(2)
  })

  it('clears every line', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))

    act(() => cart.clear())

    expect(cart.lines).toEqual([])
    expect(cart.restaurantId).toBeNull()
  })

  it('keeps itemCount and subtotal equal to the sum of the lines', () => {
    mountCart()
    act(() => cart.addItem(masala, dosaDash))
    act(() => cart.setQuantity(1, 3))
    act(() => cart.addItem(coffee, dosaDash))

    expect(cart.itemCount).toBe(4)
    expect(cart.subtotal).toBe(280)
  })

  it('saves the cart to localStorage on every change', () => {
    mountCart()

    act(() => cart.addItem(masala, dosaDash))

    expect(stored()).toMatchObject({
      restaurantId: 1,
      restaurantName: 'Dosa Dash',
      lines: { 1: { menu_item_id: 1, quantity: 1 } },
    })
  })

  it('restores a saved cart on mount', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        restaurantId: 1,
        restaurantName: 'Dosa Dash',
        lines: { 1: { menu_item_id: 1, name: 'Masala Dosa', unit_price: 80, quantity: 2 } },
      }),
    )

    mountCart()

    expect(cart.itemCount).toBe(2)
    expect(cart.subtotal).toBe(160)
    expect(cart.restaurantName).toBe('Dosa Dash')
  })

  it.each([
    ['unparseable json', '{not json'],
    ['a wrong shape', JSON.stringify({ lines: 'nope' })],
    ['a line with a bad quantity', JSON.stringify({ lines: { 1: { menu_item_id: 1, name: 'x', unit_price: 1, quantity: 'two' } } })],
  ])('falls back to an empty cart for %s in storage', (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw)

    mountCart()

    expect(cart.lines).toEqual([])
    expect(cart.restaurantId).toBeNull()
  })
})

describe('useCart', () => {
  it('throws outside a CartProvider', () => {
    const quiet = console.error
    console.error = () => {}
    try {
      expect(() => render(<Probe />)).toThrow(/CartProvider/)
    } finally {
      console.error = quiet
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
