import { beforeEach, describe, expect, it } from 'vitest'
import { cancelOrder, getOrder, listOrders, placeOrder } from './orders.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

// The store is seeded with 15 orders, so the first new order is #16.
const SEEDED_ORDERS = 15
const FIRST_NEW_ORDER_ID = SEEDED_ORDERS + 1

const request = (overrides = {}) => ({
  restaurant_id: 1,
  items: [
    { menu_item_id: 1, quantity: 2 },
    { menu_item_id: 6, quantity: 1 },
  ],
  delivery_address: 'Block C, Room 12',
  note: 'extra crispy',
  ...overrides,
})

beforeEach(() => {
  resetAuthWorld()
  signInAs(1)
})

describe('placeOrder', () => {
  it('places a PLACED order with a price snapshot and totals including the Rs. 20 fee', async () => {
    const order = await placeOrder(request())

    expect(order).toMatchObject({
      id: FIRST_NEW_ORDER_ID,
      customer_id: 1,
      restaurant_id: 1,
      restaurant_name: 'Dosa Dash',
      status: 'PLACED',
      subtotal: 200,
      delivery_fee: 20,
      total: 220,
      delivery_address: 'Block C, Room 12',
      note: 'extra crispy',
      payment: { method: 'mock', status: 'mock_paid' },
    })
    expect(order.items).toEqual([
      { menu_item_id: 1, name: 'Masala Dosa', unit_price: 80, quantity: 2, line_total: 160 },
      { menu_item_id: 6, name: 'Filter Coffee', unit_price: 40, quantity: 1, line_total: 40 },
    ])
    expect(order.status_history).toEqual([{ status: 'PLACED', changed_at: expect.any(String) }])
  })

  it('numbers orders one after another', async () => {
    const first = await placeOrder(request())
    const second = await placeOrder(request())

    expect([first.id, second.id]).toEqual([FIRST_NEW_ORDER_ID, FIRST_NEW_ORDER_ID + 1])
  })

  it('takes prices from the menu, ignoring any price or total the client sends', async () => {
    const order = await placeOrder(
      request({
        items: [{ menu_item_id: 1, quantity: 1, unit_price: 1, price: 1, name: 'Free dosa' }],
        total: 1,
        subtotal: 1,
      }),
    )

    expect(order.items[0]).toMatchObject({ name: 'Masala Dosa', unit_price: 80, line_total: 80 })
    expect(order.total).toBe(100)
  })

  it('keeps a placed order unchanged when the menu price later changes', async () => {
    const placed = await placeOrder(request())

    store.menuItems.find((item) => item.id === 1).price = 999
    const reloaded = await getOrder(placed.id)

    expect(reloaded.items[0].unit_price).toBe(80)
    expect(reloaded.total).toBe(220)
  })

  it('trims the address and defaults a missing note to empty', async () => {
    const order = await placeOrder(request({ delivery_address: '  Hostel 4, room 9  ', note: undefined }))

    expect(order.delivery_address).toBe('Hostel 4, room 9')
    expect(order.note).toBe('')
  })

  it('rejects an empty cart with 422 empty_cart', async () => {
    await expect(placeOrder(request({ items: [] }))).rejects.toMatchObject({ status: 422, code: 'empty_cart' })
  })

  it.each([
    ['too short', 'abcd'],
    ['blank', '    '],
    ['missing', undefined],
    ['too long', 'x'.repeat(201)],
  ])('rejects a %s address with 422 invalid_address', async (_label, address) => {
    await expect(placeOrder(request({ delivery_address: address }))).rejects.toMatchObject({
      status: 422,
      code: 'invalid_address',
    })
  })

  it.each([0, 21, 1.5, '2', -1])('rejects quantity %j with 422 invalid_quantity', async (quantity) => {
    await expect(placeOrder(request({ items: [{ menu_item_id: 1, quantity }] }))).rejects.toMatchObject({
      status: 422,
      code: 'invalid_quantity',
    })
  })

  it('accepts the quantity limits 1 and 20', async () => {
    const order = await placeOrder(request({ items: [{ menu_item_id: 1, quantity: 20 }] }))

    expect(order.subtotal).toBe(1600)
  })

  it('rejects an unknown restaurant with 404', async () => {
    await expect(placeOrder(request({ restaurant_id: 999 }))).rejects.toMatchObject({ status: 404 })
  })

  it('rejects an unknown menu item with 404', async () => {
    await expect(placeOrder(request({ items: [{ menu_item_id: 999, quantity: 1 }] }))).rejects.toMatchObject({
      status: 404,
    })
  })

  it('rejects an unavailable item with 409 naming the dish', async () => {
    const attempt = placeOrder(request({ items: [{ menu_item_id: 3, quantity: 1 }] }))

    await expect(attempt).rejects.toMatchObject({ status: 409, code: 'item_unavailable' })
    await expect(attempt).rejects.toThrow(/Cheese Dosa/)
  })

  it('rejects dishes from another restaurant with 422 mixed_restaurants', async () => {
    await expect(
      placeOrder(request({ items: [{ menu_item_id: 1, quantity: 1 }, { menu_item_id: 8, quantity: 1 }] })),
    ).rejects.toMatchObject({ status: 422, code: 'mixed_restaurants' })
  })

  it('stores nothing when an order is rejected', async () => {
    await placeOrder(request({ items: [{ menu_item_id: 3, quantity: 1 }] })).catch(() => {})

    expect(store.orders).toHaveLength(SEEDED_ORDERS)
    expect(store.nextOrderId).toBe(FIRST_NEW_ORDER_ID)
  })

  it.each([
    ['owner', 6],
    ['delivery partner', 3],
  ])('refuses a %s with 403', async (_role, id) => {
    signInAs(id, 'x')

    await expect(placeOrder(request())).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a guest with 401', async () => {
    resetAuthWorld()

    await expect(placeOrder(request())).rejects.toMatchObject({ status: 401 })
  })
})

describe('getOrder', () => {
  it('returns the customer their own order', async () => {
    const placed = await placeOrder(request())

    expect(await getOrder(placed.id)).toEqual(placed)
  })

  it.each([
    ['the owning customer', 1, 3],
    ['the owner of that restaurant', 6, 3],
    ['the assigned delivery partner', 3, 3],
  ])('lets %s read an order', async (_who, userId, orderId) => {
    signInAs(userId)

    await expect(getOrder(orderId)).resolves.toMatchObject({ id: orderId })
  })

  it.each([
    ['another customer', 2, 3],
    ['the owner of another restaurant', 7, 3],
    ['a delivery partner who is not assigned', 4, 3],
    ['a delivery partner on an order with no rider', 3, 7],
  ])('answers 404 for %s', async (_who, userId, orderId) => {
    signInAs(userId)

    await expect(getOrder(orderId)).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })

  it('hides another customer\'s order behind 404', async () => {
    const placed = await placeOrder(request())
    signInAs(2)

    await expect(getOrder(placed.id)).rejects.toMatchObject({ status: 404 })
  })

  it('answers 404 for an order that does not exist', async () => {
    await expect(getOrder(42)).rejects.toMatchObject({ status: 404 })
  })

  it('refuses a guest with 401', async () => {
    const placed = await placeOrder(request())
    resetAuthWorld()
    store.orders.push(placed)

    await expect(getOrder(placed.id)).rejects.toMatchObject({ status: 401 })
  })

  it('does not let callers mutate stored orders through the returned copy', async () => {
    const placed = await placeOrder(request())
    placed.status = 'DELIVERED'

    expect((await getOrder(placed.id)).status).toBe('PLACED')
  })
})

const idsOf = (page) => page.items.map((order) => order.id)
const localDay = (iso) => {
  const day = new Date(iso)
  const pad = (value) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}
const createdAt = (id) => store.orders.find((order) => order.id === id).created_at

describe('seed orders', () => {
  it('ends every status history on the order status', () => {
    const mismatched = store.orders.filter((order) => order.status_history.at(-1).status !== order.status)

    expect(mismatched).toEqual([])
  })
})

describe('listOrders', () => {
  it('lists a customer only their own orders, newest first', async () => {
    const page = await listOrders()

    expect(idsOf(page)).toEqual([15, 12, 10, 8, 5, 4, 3])
    expect(page.total).toBe(7)
  })

  it('lists a different set to another customer', async () => {
    signInAs(2)

    expect(idsOf(await listOrders())).toEqual([14, 13, 11, 9, 7, 6, 2, 1])
  })

  it('puts a freshly placed order at the top', async () => {
    const placed = await placeOrder(request())

    expect((await listOrders()).items[0].id).toBe(placed.id)
  })

  it('filters by status', async () => {
    expect(idsOf(await listOrders({ status: 'CANCELLED' }))).toEqual([4])
  })

  it('returns an empty page when the customer has no order in that status', async () => {
    signInAs(2)

    expect(await listOrders({ status: 'CANCELLED' })).toMatchObject({ items: [], total: 0 })
  })

  it('includes orders placed on both boundary days of a date range', async () => {
    const page = await listOrders({ date_from: localDay(createdAt(3)), date_to: localDay(createdAt(4)) })

    expect(idsOf(page)).toEqual([4, 3])
  })

  it('treats date_to as the whole day, including a late evening order', async () => {
    const lateEvening = new Date(createdAt(3))
    lateEvening.setHours(23, 30, 0, 0)
    store.orders.find((order) => order.id === 3).created_at = lateEvening.toISOString()

    const page = await listOrders({ date_from: localDay(createdAt(3)), date_to: localDay(createdAt(3)) })

    expect(idsOf(page)).toEqual([3])
  })

  it('excludes orders before date_from', async () => {
    const page = await listOrders({ date_from: localDay(createdAt(15)) })

    expect(idsOf(page)).not.toContain(3)
    expect(idsOf(page)).toContain(15)
  })

  it('combines status and date filters', async () => {
    const page = await listOrders({ status: 'DELIVERED', date_to: localDay(createdAt(3)) })

    expect(idsOf(page)).toEqual([3])
  })

  it('pages ten at a time with the total across pages', async () => {
    for (let count = 0; count < 5; count += 1) await placeOrder(request())

    const first = await listOrders()
    const second = await listOrders({ page: 2 })

    expect(first.items).toHaveLength(10)
    expect(first).toMatchObject({ total: 12, page: 1, page_size: 10 })
    expect(second.items).toHaveLength(2)
    expect(idsOf(first).at(-1)).toBeGreaterThan(idsOf(second)[0])
  })

  it('scopes an owner to their own restaurant', async () => {
    signInAs(6)

    expect(idsOf(await listOrders())).toEqual([15, 14, 11, 7, 3, 1])
  })

  it('scopes a delivery partner to orders assigned to them', async () => {
    signInAs(3)

    expect(idsOf(await listOrders())).toEqual([8, 6, 3, 2, 1])
  })

  it('answers 422 invalid_status for an unknown status', async () => {
    await expect(listOrders({ status: 'LOST' })).rejects.toMatchObject({ status: 422, code: 'invalid_status' })
  })

  it.each([
    ['a start after the end', { date_from: '2026-05-10', date_to: '2026-05-01' }],
    ['a malformed date', { date_from: '10/05/2026' }],
  ])('answers 422 invalid_date_range for %s', async (_label, filters) => {
    await expect(listOrders(filters)).rejects.toMatchObject({ status: 422, code: 'invalid_date_range' })
  })

  it('refuses a guest with 401', async () => {
    resetAuthWorld()

    await expect(listOrders()).rejects.toMatchObject({ status: 401 })
  })

  it('does not let callers mutate stored orders through the listed copy', async () => {
    const page = await listOrders()
    page.items[0].status = 'DELIVERED'

    expect((await getOrder(15)).status).toBe('PLACED')
  })
})

describe('cancelOrder', () => {
  it('cancels a PLACED order and appends CANCELLED to its history', async () => {
    const cancelled = await cancelOrder(15)

    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.status_history.map((entry) => entry.status)).toEqual(['PLACED', 'CANCELLED'])
    expect((await getOrder(15)).status).toBe('CANCELLED')
  })

  it.each([12, 10, 8, 5, 3, 4])('answers 409 invalid_transition for order %i past PLACED', async (id) => {
    const before = (await getOrder(id)).status

    await expect(cancelOrder(id)).rejects.toMatchObject({ status: 409, code: 'invalid_transition' })
    expect((await getOrder(id)).status).toBe(before)
  })

  it('answers 404 for another customer\'s order and leaves it untouched', async () => {
    await expect(cancelOrder(14)).rejects.toMatchObject({ status: 404 })
    signInAs(2)
    expect((await getOrder(14)).status).toBe('PLACED')
  })

  it('answers 404 for an order that does not exist', async () => {
    await expect(cancelOrder(999)).rejects.toMatchObject({ status: 404 })
  })

  it('refuses an owner with 403', async () => {
    signInAs(6)

    await expect(cancelOrder(15)).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a guest with 401', async () => {
    resetAuthWorld()

    await expect(cancelOrder(15)).rejects.toMatchObject({ status: 401 })
  })
})
