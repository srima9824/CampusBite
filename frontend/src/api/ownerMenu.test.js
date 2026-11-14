import { beforeEach, describe, expect, it } from 'vitest'
import { placeOrder } from './orders.js'
import { createMenuItem, deleteMenuItem, setMenuItemAvailability, updateMenuItem } from './owner.js'
import { restaurants } from './index.js'
import { store } from './store.js'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'

const OWNER_1 = 6
const valid = { name: 'Test Dosa', description: ' Crisp ', category: ' Dosas ', price: 99.5 }

beforeEach(() => {
  resetAuthWorld()
  signInAs(OWNER_1, 'OWNER')
})

describe('createMenuItem', () => {
  it('adds a trimmed, available item for the owner\'s restaurant with the next id', async () => {
    const before = store.menuItems.length
    const nextId = Math.max(...store.menuItems.map((item) => item.id)) + 1

    const item = await createMenuItem(valid)

    expect(item).toMatchObject({
      id: nextId,
      restaurant_id: 1,
      name: 'Test Dosa',
      description: 'Crisp',
      category: 'Dosas',
      price: 99.5,
      is_available: true,
    })
    expect(store.menuItems).toHaveLength(before + 1)
  })

  it('shows the new dish on the public menu at once', async () => {
    await createMenuItem(valid)

    const menu = await restaurants.listMenu(1)

    expect(menu.items.map((item) => item.name)).toContain('Test Dosa')
  })

  it('accepts is_available false', async () => {
    expect((await createMenuItem({ ...valid, is_available: false })).is_available).toBe(false)
  })

  it('refuses invalid values with 422 validation_error and a message per field, creating nothing', async () => {
    const before = store.menuItems.length

    const failure = await createMenuItem({ name: '', category: '', price: '' }).catch((error) => error)

    expect(failure).toMatchObject({ status: 422, code: 'validation_error' })
    expect(Object.keys(failure.fields).sort()).toEqual(['category', 'name', 'price'])
    expect(failure.fields.price).toMatch(/price above 0/)
    expect(store.menuItems).toHaveLength(before)
  })

  it('refuses a name already on the menu, ignoring case and spaces, with 409 duplicate_name', async () => {
    const failure = await createMenuItem({ ...valid, name: '  masala DOSA ' }).catch((error) => error)

    expect(failure).toMatchObject({ status: 409, code: 'duplicate_name' })
    expect(failure.fields.name).toMatch(/already has a dish/)
  })

  it('allows a name that another restaurant uses', async () => {
    const item = await createMenuItem({ ...valid, name: 'Veg Hakka Noodles' })

    expect(item.restaurant_id).toBe(1)
  })

  it('refuses a customer with 403 and a guest with 401', async () => {
    signInAs(1)
    await expect(createMenuItem(valid)).rejects.toMatchObject({ status: 403 })

    localStorage.clear()
    await expect(createMenuItem(valid)).rejects.toMatchObject({ status: 401 })
  })
})

describe('updateMenuItem', () => {
  it('changes the fields and keeps availability when none is given', async () => {
    const item = await updateMenuItem(3, { name: 'Cheese Dosa', description: '', category: 'Dosas', price: '130' })

    expect(item).toMatchObject({ id: 3, price: 130, is_available: false })
  })

  it('allows saving an item under its own name', async () => {
    await expect(updateMenuItem(1, { name: 'masala dosa', category: 'Dosas', price: 85 })).resolves.toMatchObject({
      price: 85,
    })
  })

  it('refuses renaming onto another dish of the same menu with 409 duplicate_name', async () => {
    await expect(updateMenuItem(1, { name: 'Filter Coffee', category: 'Dosas', price: 80 })).rejects.toMatchObject({
      status: 409,
      code: 'duplicate_name',
    })
  })

  it('refuses invalid values with 422 and per-field messages, leaving the item untouched', async () => {
    const failure = await updateMenuItem(1, { name: 'M', category: 'Dosas', price: 'free' }).catch((error) => error)

    expect(failure).toMatchObject({ status: 422, code: 'validation_error' })
    expect(Object.keys(failure.fields).sort()).toEqual(['name', 'price'])
    expect(store.menuItems.find((item) => item.id === 1).name).toBe('Masala Dosa')
  })

  it('answers 404 for another restaurant\'s item and leaves it untouched', async () => {
    await expect(updateMenuItem(8, { name: 'Hijack', category: 'Noodles', price: 1 })).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
    })
    expect(store.menuItems.find((item) => item.id === 8).name).toBe('Veg Hakka Noodles')
  })
})

describe('setMenuItemAvailability', () => {
  it('switches an item off and the public menu shows it sold out', async () => {
    await setMenuItemAvailability(1, { is_available: false })

    const menu = await restaurants.listMenu(1)

    expect(menu.items.find((item) => item.id === 1).is_available).toBe(false)
  })

  it('switches it back on', async () => {
    const item = await setMenuItemAvailability(3, { is_available: true })

    expect(item.is_available).toBe(true)
  })

  it('makes checkout refuse the dish while it is off', async () => {
    await setMenuItemAvailability(1, { is_available: false })
    signInAs(1)

    await expect(
      placeOrder({ restaurant_id: 1, items: [{ menu_item_id: 1, quantity: 1 }], delivery_address: 'Block C, Room 12' }),
    ).rejects.toMatchObject({ status: 409, code: 'item_unavailable' })
  })

  it('answers 404 for another restaurant\'s item', async () => {
    await expect(setMenuItemAvailability(8, { is_available: false })).rejects.toMatchObject({ status: 404 })
    expect(store.menuItems.find((item) => item.id === 8).is_available).toBe(true)
  })
})

describe('deleteMenuItem', () => {
  it('removes the item from the menu but keeps placed order lines as they were', async () => {
    const lineBefore = structuredClone(store.orders.find((order) => order.id === 14).items)

    await deleteMenuItem(1)

    expect(store.menuItems.some((item) => item.id === 1)).toBe(false)
    expect(store.orders.find((order) => order.id === 14).items).toEqual(lineBefore)
  })

  it('answers 404 for another restaurant\'s item and for one already gone', async () => {
    await expect(deleteMenuItem(8)).rejects.toMatchObject({ status: 404 })
    await deleteMenuItem(1)
    await expect(deleteMenuItem(1)).rejects.toMatchObject({ status: 404 })
    expect(store.menuItems.some((item) => item.id === 8)).toBe(true)
  })

  it('never reuses the id of a deleted item', async () => {
    const created = await createMenuItem(valid)
    await deleteMenuItem(created.id)

    const next = await createMenuItem({ ...valid, name: 'Another Dosa' })

    expect(next.id).toBeGreaterThan(created.id)
  })
})
