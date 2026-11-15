import { request } from './http.js'

const ROLES = {
  customer: 'CUSTOMER',
  restaurant_owner: 'OWNER',
  delivery_partner: 'DELIVERY_PARTNER',
}

function toUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: ROLES[user.role] ?? user.role }
}

function toSession({ access_token: token, user }) {
  return { access_token: token, token_type: 'bearer', user: toUser(user) }
}

export async function login({ email, password }) {
  return toSession(await request('/auth/login', { method: 'POST', body: { email, password } }))
}

// Sign-up always creates a customer and signs the person in.
export async function register({ name, email, password }) {
  return toSession(await request('/auth/register', { method: 'POST', body: { name, email, password } }))
}

export async function getCurrentUser() {
  return toUser(await request('/auth/me'))
}
