import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { subtotal } from '../lib/cartTotals.js'

const STORAGE_KEY = 'campusbite.cart'
const MIN_QUANTITY = 1
const MAX_QUANTITY = 20
const EMPTY_CART = { restaurantId: null, restaurantName: '', lines: {} }

const CartContext = createContext(null)

function clamp(quantity) {
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity))
}

function isValidCart(value) {
  return (
    value &&
    typeof value.lines === 'object' &&
    value.lines !== null &&
    Object.values(value.lines).every(
      (line) =>
        Number.isInteger(line?.menu_item_id) &&
        typeof line.name === 'string' &&
        typeof line.unit_price === 'number' &&
        Number.isInteger(line.quantity),
    )
  )
}

function readStoredCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return isValidCart(stored) ? stored : EMPTY_CART
  } catch {
    return EMPTY_CART
  }
}

function toLine(item, quantity) {
  return { menu_item_id: item.id, name: item.name, unit_price: item.price, quantity }
}

function singleItemCart(item, restaurant) {
  return {
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    lines: { [item.id]: toLine(item, 1) },
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
    } catch {
      // Storage can be full or blocked; the cart still works for this page session.
    }
  }, [cart])

  const addItem = useCallback(
    (item, restaurant) => {
      if (cart.restaurantId !== null && cart.restaurantId !== restaurant.id) {
        return { conflict: true }
      }
      setCart((current) => {
        if (current.restaurantId === null) return singleItemCart(item, restaurant)
        const existing = current.lines[item.id]
        const quantity = clamp((existing?.quantity ?? 0) + 1)
        return { ...current, lines: { ...current.lines, [item.id]: toLine(item, quantity) } }
      })
      return { conflict: false }
    },
    [cart.restaurantId],
  )

  const setQuantity = useCallback((menuItemId, quantity) => {
    setCart((current) => {
      const line = current.lines[menuItemId]
      if (!line) return current
      if (quantity < MIN_QUANTITY) {
        const rest = Object.fromEntries(
          Object.entries(current.lines).filter(([id]) => id !== String(menuItemId)),
        )
        return Object.keys(rest).length ? { ...current, lines: rest } : EMPTY_CART
      }
      return {
        ...current,
        lines: { ...current.lines, [menuItemId]: { ...line, quantity: clamp(quantity) } },
      }
    })
  }, [])

  const removeItem = useCallback((menuItemId) => setQuantity(menuItemId, 0), [setQuantity])
  const clear = useCallback(() => setCart(EMPTY_CART), [])
  const replaceWith = useCallback(
    (item, restaurant) => setCart(singleItemCart(item, restaurant)),
    [],
  )

  const value = useMemo(() => {
    const lines = Object.values(cart.lines)
    return {
      restaurantId: cart.restaurantId,
      restaurantName: cart.restaurantName,
      lines,
      itemCount: lines.reduce((count, line) => count + line.quantity, 0),
      subtotal: subtotal(lines),
      addItem,
      setQuantity,
      removeItem,
      clear,
      replaceWith,
    }
  }, [cart, addItem, setQuantity, removeItem, clear, replaceWith])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside CartProvider')
  return value
}
