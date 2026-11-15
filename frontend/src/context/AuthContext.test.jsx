import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_EXPIRED_EVENT } from '../api/http.js'
import { getSession, saveSession } from '../api/session.js'
import { AuthProvider, useAuth } from './AuthContext.jsx'

const backendUser = { id: 7, name: 'Maya Patel', email: 'maya@masaischool.ac.in', role: 'customer' }

function reply(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function Probe() {
  const { user, status, login, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? `${user.name} ${user.role}` : 'nobody'}</p>
      <button onClick={() => login({ email: backendUser.email, password: 'secret-pass-1' })}>log in</button>
      <button onClick={logout}>log out</button>
    </div>
  )
}

const renderProbe = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )

describe('login and session', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('logs in, saves the token and maps the role, then logs out', async () => {
    vi.stubGlobal('fetch', () => reply(200, { access_token: 'tok.en', token_type: 'bearer', user: backendUser }))
    renderProbe()

    await userEvent.click(screen.getByText('log in'))

    expect(await screen.findByText('Maya Patel CUSTOMER')).toBeInTheDocument()
    expect(getSession().token).toBe('tok.en')

    await userEvent.click(screen.getByText('log out'))

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    expect(getSession()).toBeNull()
  })

  it('restores a saved session after a page reload by asking the backend who it is', async () => {
    saveSession({ token: 'tok.en', user: backendUser })
    const fetchMock = vi.fn(() => reply(200, backendUser))
    vi.stubGlobal('fetch', fetchMock)

    renderProbe()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(fetchMock.mock.calls[0][0].pathname).toBe('/auth/me')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok.en')
  })

  it('drops a saved session the backend no longer accepts', async () => {
    saveSession({ token: 'expired', user: backendUser })
    vi.stubGlobal('fetch', () =>
      reply(401, { detail: { code: 'not_authenticated', message: 'Log in to continue.' } }),
    )

    renderProbe()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(getSession()).toBeNull()
  })

  it('logs the person out when the token expires during use', async () => {
    vi.stubGlobal('fetch', () => reply(200, { access_token: 'tok.en', token_type: 'bearer', user: backendUser }))
    renderProbe()
    await userEvent.click(screen.getByText('log in'))
    await screen.findByText('Maya Patel CUSTOMER')

    act(() => {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    })

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
  })
})
