import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CartProvider } from '../context/CartContext.jsx'
import Checkout from './Checkout.jsx'
import OrderConfirmation from './OrderConfirmation.jsx'

const PLACED_ORDER = {
  id: 7,
  status: 'PLACED',
  total: 260,
  delivery_address: 'Block B, Room 204',
  notes: null,
  updated_at: '2026-11-15T10:00:00Z',
  restaurant: { id: 1, name: 'Dosa Dash' },
  items: [{ menu_item_id: 3, name: 'Masala Dosa', unit_price: 130, quantity: 2, line_total: 260 }],
  payment: { method: 'mock', status: 'mock_paid' },
}

function jsonResponse(body, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function renderCheckout() {
  localStorage.setItem(
    'campusbite.cart',
    JSON.stringify({
      restaurantId: 1,
      restaurantName: 'Dosa Dash',
      lines: { 3: { menu_item_id: 3, name: 'Masala Dosa', unit_price: 130, quantity: 2 } },
    }),
  )
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={['/checkout']}>
        <Routes>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
          <Route path="/cart" element={<p>Cart page</p>} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  )
}

describe('checkout', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('places the order, empties the cart and shows the confirmation', async () => {
    const fetchMock = vi.fn((url, init) =>
      init?.method === 'POST' ? jsonResponse(PLACED_ORDER, 201) : jsonResponse(PLACED_ORDER),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderCheckout()

    await userEvent.type(screen.getByLabelText(/delivery address/i), 'Block B, Room 204')
    await userEvent.click(screen.getByRole('button', { name: /pay now/i }))

    expect(await screen.findByText(/order #7 from dosa dash/i)).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(post[1].body)).toEqual({
      items: [{ menu_item_id: 3, quantity: 2 }],
      delivery_address: 'Block B, Room 204',
    })
    expect(JSON.parse(localStorage.getItem('campusbite.cart')).lines).toEqual({})
  })

  it('keeps the cart and shows the reason when the kitchen refuses the order', async () => {
    const refusal = { detail: { code: 'item_unavailable', message: 'Masala Dosa is not available right now.' } }
    vi.stubGlobal('fetch', vi.fn(() => jsonResponse(refusal, 409)))
    renderCheckout()

    await userEvent.type(screen.getByLabelText(/delivery address/i), 'Block B, Room 204')
    await userEvent.click(screen.getByRole('button', { name: /pay now/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Masala Dosa is not available right now.')
    await waitFor(() => expect(JSON.parse(localStorage.getItem('campusbite.cart')).lines[3].quantity).toBe(2))
  })
})
