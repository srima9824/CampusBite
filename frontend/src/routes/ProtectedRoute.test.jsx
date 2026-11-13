import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import { roleHome } from './roleHome.js'

function Where({ name }) {
  const { state } = useLocation()
  return (
    <div>
      <p>at {name}</p>
      <p data-testid="from">{state?.from ?? ''}</p>
      <p data-testid="notice">{state?.notice ?? ''}</p>
    </div>
  )
}

function renderGuarded(path) {
  return renderWithAuth(
    <Routes>
      <Route path="/" element={<Where name="home" />} />
      <Route path="/login" element={<Where name="login" />} />
      <Route path="/owner" element={<Where name="owner home" />} />
      <Route element={<ProtectedRoute roles={['OWNER']} />}>
        <Route path="/secret" element={<Where name="secret" />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/any" element={<Where name="any" />} />
      </Route>
    </Routes>,
    { entries: [path] },
  )
}

beforeEach(resetAuthWorld)

describe('ProtectedRoute', () => {
  it('sends a guest to login and remembers the requested path', async () => {
    renderGuarded('/secret?tab=1')

    expect(await screen.findByText('at login')).toBeInTheDocument()
    expect(screen.getByTestId('from')).toHaveTextContent('/secret?tab=1')
  })

  it('shows a loading placeholder while the saved session is checked', () => {
    signInAs(6, 'OWNER')

    renderGuarded('/secret')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('at secret')).not.toBeInTheDocument()
  })

  it('renders the page for an allowed role', async () => {
    signInAs(6, 'OWNER')

    renderGuarded('/secret')

    expect(await screen.findByText('at secret')).toBeInTheDocument()
  })

  it('sends a wrong role to its own home with a notice', async () => {
    signInAs(1)

    renderGuarded('/secret')

    expect(await screen.findByText('at home')).toBeInTheDocument()
    expect(screen.getByTestId('notice')).not.toBeEmpty()
  })

  it('lets any signed-in role through when no roles are required', async () => {
    signInAs(1)

    renderGuarded('/any')

    expect(await screen.findByText('at any')).toBeInTheDocument()
  })
})

describe('roleHome', () => {
  it.each([
    ['CUSTOMER', '/'],
    ['OWNER', '/owner'],
    ['DELIVERY_PARTNER', '/delivery'],
    ['SOMETHING_ELSE', '/'],
  ])('maps %s to %s', (role, path) => {
    expect(roleHome(role)).toBe(path)
  })
})
