import { beforeEach, describe, expect, it } from 'vitest'
import { getOrder, listOrders, updateOrderStatus } from './orders.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

// Seed: Sam (3) has #8 READY, #6 OUT_FOR_DELIVERY and #1-#3 DELIVERED; Priya (4) has #5 OUT_FOR_DELIVERY;
// #7 is READY with no partner; Jonah (5) has nothing.
const SAM = 3
const PRIYA = 4
const JONAH = 5
const OWNER_1 = 6

const statusOf = (id) => store.orders.find((order) => order.id === id).status

beforeEach(() => {
  resetAuthWorld()
  signInAs(SAM, 'DELIVERY_PARTNER')
})

describe('updateOrderStatus as a delivery partner', () => {
  it('picks up an assigned READY order and records the step', async () => {
    const order = await updateOrderStatus(8, { status: 'OUT_FOR_DELIVERY' })

    expect(order.status).toBe('OUT_FOR_DELIVERY')
    expect(order.status_history.at(-1).status).toBe('OUT_FOR_DELIVERY')
    expect(statusOf(8)).toBe('OUT_FOR_DELIVERY')
  })

  it('delivers an assigned OUT_FOR_DELIVERY order', async () => {
    const order = await updateOrderStatus(6, { status: 'DELIVERED' })

    expect(order.status).toBe('DELIVERED')
    expect(order.status_history.map((step) => step.status).at(-2)).toBe('OUT_FOR_DELIVERY')
    expect(statusOf(6)).toBe('DELIVERED')
  })

  it('walks one order from READY to DELIVERED in two moves', async () => {
    await updateOrderStatus(8, { status: 'OUT_FOR_DELIVERY' })
    const delivered = await updateOrderStatus(8, { status: 'DELIVERED' })

    expect(delivered.status_history.map((step) => step.status).slice(-3)).toEqual(['READY', 'OUT_FOR_DELIVERY', 'DELIVERED'])
  })

  it.each([
    [8, 'DELIVERED'],
    [8, 'READY'],
    [8, 'CANCELLED'],
    [8, 'ACCEPTED'],
    [6, 'READY'],
    [6, 'OUT_FOR_DELIVERY'],
    [1, 'DELIVERED'],
  ])('refuses order #%i to %s with 409 invalid_transition and leaves it alone', async (id, status) => {
    const before = statusOf(id)

    await expect(updateOrderStatus(id, { status })).rejects.toMatchObject({ status: 409, code: 'invalid_transition' })

    expect(statusOf(id)).toBe(before)
  })

  it('cannot make an owner move on an assigned order, and an unassigned PREPARING order is 404', async () => {
    await expect(updateOrderStatus(8, { status: 'PREPARING' })).rejects.toMatchObject({ status: 409 })
    await expect(updateOrderStatus(9, { status: 'READY' })).rejects.toMatchObject({ status: 404 })
  })

  it.each([
    [7, 'an unassigned READY order'],
    [5, 'another partner\'s order'],
    [999, 'an order that does not exist'],
  ])('answers 404 for #%i (%s) and leaves it alone', async (id) => {
    const before = store.orders.find((order) => order.id === id)?.status

    await expect(updateOrderStatus(id, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 404, code: 'not_found' })

    expect(store.orders.find((order) => order.id === id)?.status).toBe(before)
  })

  it('answers 404 to an unassigned partner for every order', async () => {
    signInAs(JONAH, 'DELIVERY_PARTNER')

    await expect(updateOrderStatus(8, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 404 })
  })

  it('answers 403 for a customer and 401 for a guest', async () => {
    signInAs(1)
    await expect(updateOrderStatus(8, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 403 })

    localStorage.clear()
    await expect(updateOrderStatus(8, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 401 })
  })

  it('does not let an owner make a partner move', async () => {
    signInAs(OWNER_1, 'OWNER')

    await expect(updateOrderStatus(7, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 409 })
  })
})

describe('listOrders as a delivery partner', () => {
  it('shows only the orders assigned to the partner', async () => {
    const { items } = await listOrders()

    expect(items.map((order) => order.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 6, 8])
  })

  it('shows another partner only their own order', async () => {
    signInAs(PRIYA, 'DELIVERY_PARTNER')

    const { items } = await listOrders()

    expect(items.map((order) => order.id)).toEqual([5])
  })

  it('shows an unassigned partner no orders', async () => {
    signInAs(JONAH, 'DELIVERY_PARTNER')

    const { items, total } = await listOrders()

    expect(items).toEqual([])
    expect(total).toBe(0)
  })

  it('accepts a comma list of statuses', async () => {
    const { items } = await listOrders({ status: 'READY,OUT_FOR_DELIVERY' })

    expect(items.map((order) => order.id)).toEqual([8, 6])
  })

  it('treats a one-entry list like a single status', async () => {
    const { items } = await listOrders({ status: 'DELIVERED' })

    expect(items.map((order) => order.id)).toEqual([3, 2, 1])
  })

  it('refuses a list holding an unknown status with 422 invalid_status', async () => {
    await expect(listOrders({ status: 'READY,FLYING' })).rejects.toMatchObject({ status: 422, code: 'invalid_status' })
  })
})

describe('getOrder as a delivery partner', () => {
  it('returns the drop-off details without the customer email', async () => {
    const order = await getOrder(8)

    expect(order).toMatchObject({ restaurant_name: 'Chai & Chill', customer_name: 'Maya Patel' })
    expect(order.delivery_address).toBeTruthy()
    expect(order.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(order)).not.toContain('@')
  })

  it('answers 404 for an unassigned or another partner\'s order', async () => {
    await expect(getOrder(7)).rejects.toMatchObject({ status: 404 })
    await expect(getOrder(5)).rejects.toMatchObject({ status: 404 })
  })
})
