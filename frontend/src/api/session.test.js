import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, getSession, saveSession } from './session.js'

const session = { token: 'mock.1', user: { id: 1, name: 'Maya Patel' } }

beforeEach(() => localStorage.clear())

describe('session storage', () => {
  it('returns null when nothing is saved', () => {
    expect(getSession()).toBeNull()
  })

  it('returns what was saved', () => {
    saveSession(session)

    expect(getSession()).toEqual(session)
  })

  it('returns null after the session is cleared', () => {
    saveSession(session)

    clearSession()

    expect(getSession()).toBeNull()
  })

  it('returns null when the stored value is corrupt JSON', () => {
    localStorage.setItem('campusbite.session', '{not json')

    expect(getSession()).toBeNull()
  })

  it('returns null when the stored value has no token', () => {
    localStorage.setItem('campusbite.session', JSON.stringify({ user: {} }))

    expect(getSession()).toBeNull()
  })

  it('never stores a password', () => {
    saveSession(session)

    expect(localStorage.getItem('campusbite.session')).not.toMatch(/password/i)
  })
})
