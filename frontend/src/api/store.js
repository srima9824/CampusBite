import { buildSeedOrders } from './fixtures/orders.js'
import { menuItems } from './fixtures/menuItems.js'
import { restaurants } from './fixtures/restaurants.js'
import { users } from './fixtures/users.js'

function buildStore() {
  const orders = buildSeedOrders()
  return {
    users: structuredClone(users),
    restaurants: structuredClone(restaurants),
    menuItems: structuredClone(menuItems),
    orders,
    nextOrderId: orders.length + 1,
  }
}

export const store = buildStore()

export function resetStore() {
  Object.assign(store, buildStore())
}
