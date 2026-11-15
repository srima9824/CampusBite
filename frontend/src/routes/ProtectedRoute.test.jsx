import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSession } from '../api/session.js'
import { AuthProvider } from '../context/AuthContext.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

const people = {
  customer: { id: 1, name: 'Maya', email: 'maya@masaischool.ac.in', role: 'customer' },
  owner: { id: 2, name: 'Owner', email: 'owner1@masaischool.ac.in', role: 'restaurant_owner' },
}

function openOwnerPage(person) {
  if (person) {
    saveSession({ token: 'tok.en', user: person })
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify(person), { status: 200 })))
  }
  return render(
    <MemoryRouter initialEntries={['/owner']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/" element={<p>home page</p>} />
          <Route path="/restaurants" element={<p>customer home page</p>} />
          <Route element={<ProtectedRoute roles={['OWNER']} />}>
            <Route path="/owner" element={<p>owner page</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('protected pages', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('sends a visitor who is not logged in to the login page', async () => {
    openOwnerPage(null)

    expect(await screen.findByText('login page')).toBeInTheDocument()
  })

  it('lets the right role in', async () => {
    openOwnerPage(people.owner)

    expect(await screen.findByText('owner page')).toBeInTheDocument()
  })

  it('sends the wrong role back to its own home instead of showing the page', async () => {
    openOwnerPage(people.customer)

    expect(await screen.findByText('customer home page')).toBeInTheDocument()
    expect(screen.queryByText('owner page')).not.toBeInTheDocument()
  })
})
