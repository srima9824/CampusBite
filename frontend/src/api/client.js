import { ApiError } from './errors.js'
import { getSession } from './session.js'
import { store } from './store.js'

let latencyMs = 400

export function setLatency(ms) {
  latencyMs = ms
}

export function delay() {
  return new Promise((resolve) => setTimeout(resolve, latencyMs))
}

export { ApiError }

export function paginate(items, page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize }
}

// Temporary: sample data still being replaced by the API is matched to the signed-in person by email.
export function requireUser() {
  const email = getSession()?.user?.email
  const user = email && store.users.find((candidate) => candidate.email === email)
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please log in to continue.')
  return user
}

export function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'forbidden', 'Your account cannot open this one.')
  }
}
