import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { getSession } from '../api/session.js'
import { DEMO_PASSWORD, renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import { useAuth } from './AuthContext.jsx'

function Probe() {
  const { user, status, login, register, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? JSON.stringify(user) : 'none'}</p>
      <button onClick={() => login({ email: 'maya@campusbite.test', password: DEMO_PASSWORD }).catch(() => {})}>
        sign in
      </button>
      <button onClick={() => login({ email: 'maya@campusbite.test', password: 'wrong' }).catch(() => {})}>
        sign in badly
      </button>
      <button onClick={() => register({ name: 'Nia Ortiz', email: 'nia@campusbite.test', password: 'long-enough-1' })}>
        sign up
      </button>
      <button onClick={logout}>sign out</button>
    </div>
  )
}

const status = () => screen.getByTestId('status').textContent

beforeEach(resetAuthWorld)

describe('AuthProvider', () => {
  it('is anonymous when there is no saved session', () => {
    renderWithAuth(<Probe />)

    expect(status()).toBe('anonymous')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('starts loading, then authenticated, when a saved session is valid', async () => {
    signInAs(1)

    renderWithAuth(<Probe />)

    expect(status()).toBe('loading')
    await waitFor(() => expect(status()).toBe('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('Maya Patel')
  })

  it('discards a saved session whose token matches no user', async () => {
    signInAs(9999)

    renderWithAuth(<Probe />)

    await waitFor(() => expect(status()).toBe('anonymous'))
    expect(getSession()).toBeNull()
  })

  it('signs in, persists the session and exposes no password', async () => {
    renderWithAuth(<Probe />)

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }))

    await waitFor(() => expect(status()).toBe('authenticated'))
    expect(getSession().token).toBeTruthy()
    expect(screen.getByTestId('user').textContent).not.toMatch(/password/i)
    expect(localStorage.getItem('campusbite.session')).not.toMatch(/password/i)
  })

  it('stays anonymous when the password is wrong', async () => {
    renderWithAuth(<Probe />)

    await userEvent.click(screen.getByRole('button', { name: 'sign in badly' }))

    await act(async () => {})
    expect(status()).toBe('anonymous')
    expect(getSession()).toBeNull()
  })

  it('logs out and clears the saved session', async () => {
    signInAs(1)
    renderWithAuth(<Probe />)
    await waitFor(() => expect(status()).toBe('authenticated'))

    await userEvent.click(screen.getByRole('button', { name: 'sign out' }))

    expect(status()).toBe('anonymous')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(getSession()).toBeNull()
  })

  it('registers a customer and signs them in', async () => {
    renderWithAuth(<Probe />)

    await userEvent.click(screen.getByRole('button', { name: 'sign up' }))

    await waitFor(() => expect(status()).toBe('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('"role":"CUSTOMER"')
    expect(screen.getByTestId('user')).toHaveTextContent('Nia Ortiz')
  })
})

describe('useAuth', () => {
  it('throws outside an AuthProvider', () => {
    const quiet = console.error
    console.error = () => {}
    try {
      expect(() => render(<Probe />)).toThrow(/inside AuthProvider/)
    } finally {
      console.error = quiet
    }
  })
})
