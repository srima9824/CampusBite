import { restaurants } from './fixtures/restaurants.js'
import { users } from './fixtures/users.js'

function buildStore() {
  return {
    users: structuredClone(users),
    restaurants: structuredClone(restaurants),
  }
}

export const store = buildStore()

export function resetStore() {
  Object.assign(store, buildStore())
}
