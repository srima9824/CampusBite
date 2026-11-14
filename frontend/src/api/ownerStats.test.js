import { beforeEach, describe, expect, it } from 'vitest'
import { cancelOrder, placeOrder, updateOrderStatus } from './orders.js'
import { getRestaurantStats } from './owner.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

const OWNER_1 = 6

const total = (id) => store.orders.find((order) => order.id === id).total

beforeEach(() => {
  resetAuthWorld()
  signInAs(OWNER_1, 'OWNER')
})

describe('getRestaurantStats', () => {
  it('counts only this restaurant\'s orders, by status, and the seeded top items', async () => {
    const stats = await getRestaurantStats()

    expect(stats.total_orders).toBe(6)
    expect(stats.by_status).toEqual({
      PLACED: 2,
      ACCEPTED: 1,
      PREPARING: 0,
      READY: 1,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 2,
      CANCELLED: 0,
    })
    expect(Object.values(stats.by_status).reduce((sum, count) => sum + count, 0)).toBe(stats.total_orders)
  })

  it('sums revenue over the restaurant\'s orders', async () => {
    const stats = await getRestaurantStats()

    const expected = [1, 3, 7, 11, 14, 15].reduce((sum, id) => sum + total(id), 0)
    expect(stats.revenue).toBeCloseTo(expected, 2)
  })

  it('ranks top items by quantity, with ties by name, at most five', async () => {
    const stats = await getRestaurantStats()

    expect(stats.top_items.length).toBeLessThanOrEqual(5)
    expect(stats.top_items[0]).toEqual({ menu_item_id: 4, name: 'Idli Sambar', quantity: 3 })
    const quantities = stats.top_items.map((item) => item.quantity)
    expect(quantities).toEqual([...quantities].sort((a, b) => b - a))
  })

  it('excludes cancelled orders from revenue and top_items but keeps them in total_orders and orders_today', async () => {
    const before = await getRestaurantStats()
    signInAs(1)
    const order = await placeOrder({
      restaurant_id: 1,
      items: [{ menu_item_id: 5, quantity: 20 }],
      delivery_address: 'Block C, Room 12',
    })
    await cancelOrder(order.id)
    signInAs(OWNER_1, 'OWNER')

    const after = await getRestaurantStats()

    expect(after.total_orders).toBe(before.total_orders + 1)
    expect(after.orders_today).toBe(before.orders_today + 1)
    expect(after.by_status.CANCELLED).toBe(1)
    expect(after.revenue).toBe(before.revenue)
    expect(after.top_items).toEqual(before.top_items)
  })

  it('moves revenue and top items once a new order is placed', async () => {
    const before = await getRestaurantStats()
    signInAs(1)
    const order = await placeOrder({
      restaurant_id: 1,
      items: [{ menu_item_id: 6, quantity: 5 }],
      delivery_address: 'Block C, Room 12',
    })
    signInAs(OWNER_1, 'OWNER')

    const after = await getRestaurantStats()

    expect(after.revenue).toBeCloseTo(before.revenue + order.total, 2)
    expect(after.top_items[0]).toMatchObject({ menu_item_id: 6, quantity: 7 })
  })

  it('counts orders_today by local calendar day, not the seeded week-old orders', async () => {
    const stats = await getRestaurantStats()

    const today = new Date().toDateString()
    const expected = store.orders.filter(
      (order) => order.restaurant_id === 1 && new Date(order.created_at).toDateString() === today,
    ).length
    expect(stats.orders_today).toBe(expected)
    expect(stats.orders_today).toBeLessThan(stats.total_orders)
  })

  it('follows the live store when an order advances', async () => {
    await updateOrderStatus(14, { status: 'ACCEPTED' })

    const stats = await getRestaurantStats()

    expect(stats.by_status.PLACED).toBe(1)
    expect(stats.by_status.ACCEPTED).toBe(2)
  })

  it('returns zeros and an empty top list for an owner with no orders', async () => {
    store.orders = store.orders.filter((order) => order.restaurant_id !== 5)
    signInAs(10, 'OWNER')

    const stats = await getRestaurantStats()

    expect(stats).toMatchObject({ total_orders: 0, revenue: 0, orders_today: 0, top_items: [] })
  })

  it('refuses a customer with 403 and a guest with 401', async () => {
    signInAs(1)
    await expect(getRestaurantStats()).rejects.toMatchObject({ status: 403 })

    localStorage.clear()
    await expect(getRestaurantStats()).rejects.toMatchObject({ status: 401 })
  })
})
