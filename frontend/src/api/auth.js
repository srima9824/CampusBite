import { ApiError, delay, requireUser } from './client.js'
import { store } from './store.js'

function publicUser(user) {
  const copy = { ...user }
  delete copy.password
  return copy
}

export async function login({ email, password }) {
  await delay()
  const wanted = String(email ?? '').trim().toLowerCase()
  const user = store.users.find((candidate) => candidate.email.toLowerCase() === wanted)
  if (!user || user.password !== password) {
    throw new ApiError(401, 'invalid_credentials', 'That email and password do not match.')
  }
  return { access_token: `mock.${user.id}`, token_type: 'bearer', user: publicUser(user) }
}

export async function getCurrentUser() {
  await delay()
  return publicUser(requireUser())
}
