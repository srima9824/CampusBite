import { beforeEach, describe, expect, it } from 'vitest'
import { assignPartner, getOrder, listPartners, updateOrderStatus } from './orders.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

// Seed: owner 1 (user 6) has #14 PLACED, #11 ACCEPTED, #7 READY, #3 DELIVERED; owner 3 (user 8) has #13 PLACED.
const OWNER_1 = 6
const OWNER_2 = 8

beforeEach(() => {
  resetAuthWorld()
  signInAs(OWNER_1, 'OWNER')
})

describe('updateOrderStatus', () => {
  it('moves a PLACED order to ACCEPTED and records the step in its history', async () => {
    const order = await updateOrderStatus(14, { status: 'ACCEPTED' })

    expect(order.status).toBe('ACCEPTED')
    expect(order.status_history.map((step) => step.status)).toEqual(['PLACED', 'ACCEPTED'])
    expect(store.orders.find((candidate) => candidate.id === 14).status).toBe('ACCEPTED')
  })

  it('moves ACCEPTED to PREPARING and PREPARING to READY', async () => {
    const preparing = await updateOrderStatus(11, { status: 'PREPARING' })
    const ready = await updateOrderStatus(11, { status: 'READY' })

    expect(preparing.status).toBe('PREPARING')
    expect(ready.status).toBe('READY')
  })

  it.each([
    [14, 'PREPARING'],
    [14, 'READY'],
    [14, 'CANCELLED'],
    [11, 'ACCEPTED'],
    [7, 'OUT_FOR_DELIVERY'],
    [3, 'DELIVERED'],
  ])('refuses order #%i to %s with 409 invalid_transition and leaves it alone', async (id, status) => {
    const before = (await getOrder(id)).status

    await expect(updateOrderStatus(id, { status })).rejects.toMatchObject({ status: 409, code: 'invalid_transition' })

    expect((await getOrder(id)).status).toBe(before)
  })

  it('answers 404 for another restaurant\'s order', async () => {
    await expect(updateOrderStatus(13, { status: 'ACCEPTED' })).rejects.toMatchObject({ status: 404, code: 'not_found' })
    expect(store.orders.find((order) => order.id === 13).status).toBe('PLACED')
  })

  it('answers 404 for an order that does not exist', async () => {
    await expect(updateOrderStatus(999, { status: 'ACCEPTED' })).rejects.toMatchObject({ status: 404 })
  })

  it('answers 403 for a customer and 401 for a guest', async () => {
    signInAs(1)
    await expect(updateOrderStatus(14, { status: 'ACCEPTED' })).rejects.toMatchObject({ status: 403 })

    localStorage.clear()
    await expect(updateOrderStatus(14, { status: 'ACCEPTED' })).rejects.toMatchObject({ status: 401 })
  })
})

describe('listPartners', () => {
  it('returns every delivery partner as id and name from the global pool', async () => {
    const partners = await listPartners()

    expect(partners).toEqual([
      { id: 3, name: 'Sam Okafor' },
      { id: 4, name: 'Priya Nair' },
      { id: 5, name: 'Jonah Reyes' },
    ])
  })

  it('gives another restaurant\'s owner the same pool', async () => {
    signInAs(OWNER_2, 'OWNER')

    expect((await listPartners()).map((partner) => partner.id)).toEqual([3, 4, 5])
  })

  it('refuses a customer with 403', async () => {
    signInAs(1)

    await expect(listPartners()).rejects.toMatchObject({ status: 403 })
  })
})

describe('assignPartner', () => {
  it('assigns a rider to a READY order', async () => {
    const order = await assignPartner(7, { delivery_partner_id: 5 })

    expect(order.delivery_partner_id).toBe(5)
    expect(order.delivery_partner).toEqual({ id: 5, name: 'Jonah Reyes' })
    expect(order.status).toBe('READY')
  })

  it('allows reassigning while the order is still READY', async () => {
    await assignPartner(7, { delivery_partner_id: 5 })

    const order = await assignPartner(7, { delivery_partner_id: 4 })

    expect(order.delivery_partner.name).toBe('Priya Nair')
  })

  it.each([14, 11, 3])('refuses to assign on order #%i, which is not READY, with 409', async (id) => {
    await expect(assignPartner(id, { delivery_partner_id: 3 })).rejects.toMatchObject({ status: 409, code: 'invalid_state' })
  })

  it('answers 404 for a user who is not a delivery partner', async () => {
    await expect(assignPartner(7, { delivery_partner_id: 1 })).rejects.toMatchObject({ status: 404 })
    await expect(assignPartner(7, { delivery_partner_id: 7 })).rejects.toMatchObject({ status: 404 })
  })

  it('answers 404 for another restaurant\'s READY order (#8)', async () => {
    await expect(assignPartner(8, { delivery_partner_id: 3 })).rejects.toMatchObject({ status: 404 })
  })

  it('refuses a customer with 403', async () => {
    signInAs(1)

    await expect(assignPartner(7, { delivery_partner_id: 3 })).rejects.toMatchObject({ status: 403 })
  })
})
