import { getSession } from './session.js'
import { store } from './store.js'

let latencyMs = 400

export function setLatency(ms) {
  latencyMs = ms
}

export function delay() {
  return new Promise((resolve) => setTimeout(resolve, latencyMs))
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function paginate(items, page = 1, pageSize = 10) {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, page_size: pageSize }
}

// The token is "mock.<user_id>"; the store is the source of truth, not the saved user.
export function requireUser() {
  const token = getSession()?.token
  const match = /^mock\.(\d+)$/.exec(token ?? '')
  const user = match && store.users.find((candidate) => candidate.id === Number(match[1]))
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please log in to continue.')
  return user
}

export function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'forbidden', 'Your account cannot open this one.')
  }
}
