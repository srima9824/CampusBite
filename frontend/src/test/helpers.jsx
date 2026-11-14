import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { resetStore, setLatency } from '../api/testing.js'
import { clearSession, saveSession } from '../api/session.js'
import { ToastProvider } from '../components/ui'
import { AuthProvider } from '../context/AuthContext.jsx'
import { CartProvider } from '../context/CartContext.jsx'

export const DEMO_PASSWORD = 'bite-fixture-1'

export function resetAuthWorld() {
  resetStore()
  setLatency(0)
  clearSession()
}

export function signInAs(id, role = 'CUSTOMER') {
  saveSession({ token: `mock.${id}`, user: { id, role } })
}

export function renderWithAuth(ui, { entries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>{ui}</CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}
