import { beforeEach, describe, expect, it } from 'vitest'
import { auth } from './index.js'
import { clearSession, saveSession } from './session.js'
import { store } from './store.js'
import { resetStore, setLatency } from './testing.js'

const PASSWORD = 'bite-fixture-1'

beforeEach(() => {
  resetStore()
  setLatency(0)
  clearSession()
})

describe('login', () => {
  it('returns a token and the user without a password for valid credentials', async () => {
    const result = await auth.login({ email: 'maya@campusbite.test', password: PASSWORD })

    expect(result.access_token).toBeTruthy()
    expect(result.user).toMatchObject({ id: 1, role: 'CUSTOMER', email: 'maya@campusbite.test' })
    expect(result.user).not.toHaveProperty('password')
  })

  it('accepts the email in any letter case', async () => {
    const result = await auth.login({ email: ' MAYA@CampusBite.test ', password: PASSWORD })

    expect(result.user.id).toBe(1)
  })

  it.each([
    ['wrong password', { email: 'maya@campusbite.test', password: 'nope' }],
    ['unknown email', { email: 'ghost@campusbite.test', password: PASSWORD }],
  ])('rejects %s with 401 invalid_credentials', async (_name, credentials) => {
    await expect(auth.login(credentials)).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    })
  })
})

describe('getCurrentUser', () => {
  it('rejects with 401 when there is no session', async () => {
    await expect(auth.getCurrentUser()).rejects.toMatchObject({ status: 401, code: 'unauthenticated' })
  })

  it('rejects with 401 when the token names no user', async () => {
    saveSession({ token: 'mock.9999', user: {} })

    await expect(auth.getCurrentUser()).rejects.toMatchObject({ status: 401 })
  })

  it('returns the signed-in user without a password', async () => {
    const { access_token: token, user } = await auth.login({ email: 'sam@campusbite.test', password: PASSWORD })
    saveSession({ token, user })

    const current = await auth.getCurrentUser()

    expect(current).toMatchObject({ id: 3, role: 'DELIVERY_PARTNER' })
    expect(current).not.toHaveProperty('password')
  })
})

describe('register', () => {
  const newcomer = { name: 'Nia Ortiz', email: 'nia@campusbite.test', password: 'long-enough-1' }

  it('creates a customer with the next id and no password in the response', async () => {
    const created = await auth.register(newcomer)

    expect(created).toMatchObject({ id: 14, name: 'Nia Ortiz', email: 'nia@campusbite.test', role: 'CUSTOMER' })
    expect(created).not.toHaveProperty('password')
    expect(store.users).toHaveLength(14)
  })

  it('lets the new user log in', async () => {
    await auth.register(newcomer)

    const result = await auth.login({ email: newcomer.email, password: newcomer.password })

    expect(result.user.role).toBe('CUSTOMER')
  })

  it.each(['OWNER', 'DELIVERY_PARTNER', 'ADMIN'])('ignores a sent role of %s', async (role) => {
    const created = await auth.register({ ...newcomer, role })

    expect(created.role).toBe('CUSTOMER')
    expect(store.users.at(-1).role).toBe('CUSTOMER')
  })

  it.each(['maya@campusbite.test', 'MAYA@CAMPUSBITE.TEST', 'Maya@CampusBite.test'])(
    'rejects the duplicate email %s with 409 email_taken',
    async (email) => {
      await expect(auth.register({ ...newcomer, email })).rejects.toMatchObject({
        status: 409,
        code: 'email_taken',
      })
      expect(store.users).toHaveLength(13)
    },
  )
})
