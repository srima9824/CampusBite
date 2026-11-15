import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request, SESSION_EXPIRED_EVENT } from './http.js'
import { getSession, saveSession } from './session.js'

function reply(status, body) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('api client', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('sends the saved token and a JSON body', async () => {
    saveSession({ token: 'abc.def', user: { id: 1 } })
    const fetchMock = vi.fn(() => reply(200, { ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await request('/orders', { method: 'POST', body: { a: 1 }, query: { page: 2, q: '' } })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.pathname + url.search).toBe('/orders?page=2')
    expect(options.headers.Authorization).toBe('Bearer abc.def')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(options.body).toBe('{"a":1}')
  })

  it('turns a backend error into a readable ApiError', async () => {
    vi.stubGlobal('fetch', () => reply(409, { detail: { code: 'email_taken', message: 'Taken.' } }))

    await expect(request('/auth/register')).rejects.toMatchObject({
      status: 409,
      code: 'email_taken',
      message: 'Taken.',
    })
  })

  it('turns a validation list into field messages and recognises the email domain rule', async () => {
    const detail = [
      { loc: ['body', 'email'], msg: 'Value error, Enter a valid email address, like name@masaischool.ac.in.' },
    ]
    vi.stubGlobal('fetch', () => reply(422, { detail }))

    await expect(request('/auth/login')).rejects.toMatchObject({
      status: 422,
      code: 'email_domain_not_allowed',
      fields: { email: 'Enter a valid email address, like name@masaischool.ac.in.' },
    })
  })

  it('reports an unreachable server instead of crashing', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))

    await expect(request('/restaurants')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('clears the session and announces it when the token is no longer accepted', async () => {
    saveSession({ token: 'old', user: { id: 1 } })
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    vi.stubGlobal('fetch', () =>
      reply(401, { detail: { code: 'not_authenticated', message: 'Log in to continue.' } }),
    )

    await expect(request('/orders')).rejects.toMatchObject({ code: 'not_authenticated' })

    expect(getSession()).toBeNull()
    expect(expired).toHaveBeenCalledOnce()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('keeps the session when a login attempt is rejected', async () => {
    saveSession({ token: 'still-good', user: { id: 1 } })
    vi.stubGlobal('fetch', () =>
      reply(401, { detail: { code: 'invalid_credentials', message: 'Wrong email or password.' } }),
    )

    await expect(request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'invalid_credentials',
    })

    expect(getSession()?.token).toBe('still-good')
  })
})
