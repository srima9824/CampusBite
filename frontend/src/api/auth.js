import { ApiError, delay, requireUser } from './client.js'
import { store } from './store.js'
import { EMAIL_DOMAIN_MESSAGE, isAllowedEmail } from '../lib/emailDomain.js'

function requireAllowedEmail(email) {
  if (!isAllowedEmail(email)) {
    throw new ApiError(422, 'email_domain_not_allowed', EMAIL_DOMAIN_MESSAGE)
  }
}

function publicUser(user) {
  const copy = { ...user }
  delete copy.password
  return copy
}

export async function login({ email, password }) {
  await delay()
  requireAllowedEmail(email)
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

// Role is never read from the payload: sign-up always creates a customer.
export async function register({ name, email, password }) {
  await delay()
  requireAllowedEmail(email)
  const normalized = String(email).trim().toLowerCase()
  if (store.users.some((candidate) => candidate.email.toLowerCase() === normalized)) {
    throw new ApiError(409, 'email_taken', 'That email is already taken.')
  }
  const user = {
    id: Math.max(...store.users.map((candidate) => candidate.id)) + 1,
    name: String(name).trim(),
    email: normalized,
    role: 'CUSTOMER',
    password,
  }
  store.users.push(user)
  return publicUser(user)
}
