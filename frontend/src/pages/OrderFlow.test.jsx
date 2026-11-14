import { beforeEach, describe, expect, it } from 'vitest'
import { assignPartner, cancelOrder, getOrder, listOrders, placeOrder, updateOrderStatus } from '../api/orders.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

const MAYA = 1
const DOSA_DASH_OWNER = 6
const SAM = 3
const PRIYA = 4

const request = {
  restaurant_id: 1,
  items: [{ menu_item_id: 1, quantity: 2 }],
  delivery_address: 'Block C, Room 12',
  note: 'extra crispy',
}

const asCustomer = () => signInAs(MAYA, 'CUSTOMER')
const asOwner = () => signInAs(DOSA_DASH_OWNER, 'OWNER')
const asPartner = (id) => signInAs(id, 'DELIVERY_PARTNER')

beforeEach(resetAuthWorld)

describe('order lifecycle across roles', () => {
  it('takes an order from placed by the customer to delivered by the partner and shows it to the customer', async () => {
    asCustomer()
    const placed = await placeOrder(request)

    asOwner()
    await updateOrderStatus(placed.id, { status: 'ACCEPTED' })
    await updateOrderStatus(placed.id, { status: 'PREPARING' })
    await updateOrderStatus(placed.id, { status: 'READY' })
    await assignPartner(placed.id, { delivery_partner_id: SAM })

    asPartner(SAM)
    expect((await listOrders({ status: 'READY,OUT_FOR_DELIVERY' })).items.map((order) => order.id)).toContain(placed.id)
    await updateOrderStatus(placed.id, { status: 'OUT_FOR_DELIVERY' })
    await updateOrderStatus(placed.id, { status: 'DELIVERED' })
    expect((await listOrders({ status: 'DELIVERED' })).items.map((order) => order.id)).toContain(placed.id)

    asCustomer()
    const seen = await getOrder(placed.id)
    expect(seen.status).toBe('DELIVERED')
    expect(seen.delivery_partner).toEqual({ id: SAM, name: 'Sam Okafor' })
    expect(seen.status_history.map((step) => step.status)).toEqual([
      'PLACED',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ])
  })

  it('keeps the order invisible to a partner it was not assigned to along the way', async () => {
    asCustomer()
    const placed = await placeOrder(request)
    asOwner()
    await updateOrderStatus(placed.id, { status: 'ACCEPTED' })
    await updateOrderStatus(placed.id, { status: 'PREPARING' })
    await updateOrderStatus(placed.id, { status: 'READY' })
    await assignPartner(placed.id, { delivery_partner_id: SAM })

    asPartner(PRIYA)

    await expect(getOrder(placed.id)).rejects.toMatchObject({ status: 404 })
    await expect(updateOrderStatus(placed.id, { status: 'OUT_FOR_DELIVERY' })).rejects.toMatchObject({ status: 404 })
  })

  it('stops the customer from cancelling once the owner has accepted', async () => {
    asCustomer()
    const placed = await placeOrder(request)
    asOwner()
    await updateOrderStatus(placed.id, { status: 'ACCEPTED' })

    asCustomer()

    await expect(cancelOrder(placed.id)).rejects.toMatchObject({ status: 409 })
  })
})
