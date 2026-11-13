import { users } from './fixtures/users.js'

function buildStore() {
  return { users: structuredClone(users) }
}

export const store = buildStore()

export function resetStore() {
  Object.assign(store, buildStore())
}
