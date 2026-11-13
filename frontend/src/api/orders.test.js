import { beforeEach, describe, expect, it } from 'vitest'
import { getOrder, placeOrder } from './orders.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

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
      id: 1,
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

    expect([first.id, second.id]).toEqual([1, 2])
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

    expect(store.orders).toHaveLength(0)
    expect(store.nextOrderId).toBe(1)
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
