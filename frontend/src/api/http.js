import { API_URL } from './config.js'
import { ApiError } from './errors.js'
import { clearSession, getSession } from './session.js'

export const SESSION_EXPIRED_EVENT = 'campusbite:session-expired'

const NETWORK_MESSAGE = 'We could not reach the server. Check your connection and try again.'
const FALLBACK_MESSAGE = 'Something went wrong. Please try again in a moment.'
const DOMAIN_MESSAGE_START = 'Enter a valid email address'

function buildUrl(path, query) {
  const url = new URL(`${API_URL}${path}`)
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url
}

function cleanMessage(message) {
  return String(message ?? FALLBACK_MESSAGE).replace(/^Value error, /, '')
}

// FastAPI sends a list for validation errors; the app's own errors send {code, message}.
function validationError(items) {
  const fields = {}
  items.forEach((item) => {
    const field = item.loc?.at(-1)
    if (typeof field === 'string' && !fields[field]) fields[field] = cleanMessage(item.msg)
  })
  const message = cleanMessage(items[0]?.msg)
  const code = message.startsWith(DOMAIN_MESSAGE_START) ? 'email_domain_not_allowed' : 'validation_error'
  return new ApiError(422, code, message, fields)
}

async function toApiError(response) {
  let detail = null
  try {
    detail = (await response.json())?.detail
  } catch {
    detail = null
  }
  if (Array.isArray(detail)) return validationError(detail)
  if (detail?.code) return new ApiError(response.status, detail.code, detail.message ?? FALLBACK_MESSAGE)
  return new ApiError(response.status, 'server_error', FALLBACK_MESSAGE)
}

function expireSession() {
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export async function request(path, { method = 'GET', body, query, signal } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getSession()?.token
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE)
  }

  if (!response.ok) {
    const error = await toApiError(response)
    if (response.status === 401 && error.code === 'not_authenticated') expireSession()
    throw error
  }
  return response.status === 204 ? null : response.json()
}
