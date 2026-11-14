import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import { useCart } from '../context/CartContext.jsx'
import { renderWithAuth } from '../test/helpers.jsx'
import Cart from './Cart.jsx'

const dosaDash = { id: 1, name: 'Dosa Dash' }
const masala = { id: 1, name: 'Masala Dosa', price: 80 }
const coffee = { id: 6, name: 'Filter Coffee', price: 40 }

function Seed({ children }) {
  const cart = useCart()
  return (
    <>
      <button
        onClick={() => {
          cart.addItem(masala, dosaDash)
          cart.addItem(masala, dosaDash)
          cart.addItem(coffee, dosaDash)
        }}
      >
        seed
      </button>
      {children}
    </>
  )
}

async function renderCart({ seeded = true } = {}) {
  const view = renderWithAuth(
    <Routes>
      <Route
        path="/cart"
        element={
          <Seed>
            <Cart />
          </Seed>
        }
      />
      <Route path="/checkout" element={<h1>Checkout page</h1>} />
    </Routes>,
    { entries: ['/cart'] },
  )
  if (seeded) await userEvent.click(screen.getByRole('button', { name: 'seed' }))
  return view
}

describe('Cart page', () => {
  it('shows the empty state with a way back to the restaurants', async () => {
    await renderCart({ seeded: false })

    expect(screen.getByRole('heading', { level: 1, name: 'Your cart is on a diet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse restaurants' })).toHaveAttribute('href', '/restaurants')
  })

  it('lists each line with its unit price and line total', async () => {
    await renderCart()

    const lines = screen.getAllByRole('listitem')
    expect(within(lines[0]).getByRole('heading', { name: 'Masala Dosa' })).toBeInTheDocument()
    expect(within(lines[0]).getByText('Rs. 80.00 each')).toBeInTheDocument()
    expect(within(lines[0]).getByText('Rs. 160.00')).toBeInTheDocument()
    expect(within(lines[1]).getByText('Rs. 40.00')).toBeInTheDocument()
  })

  it('shows subtotal, the Rs. 20 delivery fee and the total', async () => {
    await renderCart()

    const summary = screen.getByRole('region', { name: 'Summary' })
    expect(within(summary).getByText('Rs. 200.00')).toBeInTheDocument()
    expect(within(summary).getByText('Rs. 20.00')).toBeInTheDocument()
    expect(within(summary).getByText('Rs. 220.00')).toBeInTheDocument()
  })

  it('links to the restaurant the cart came from and on to checkout', async () => {
    await renderCart()

    expect(screen.getByRole('link', { name: 'Dosa Dash' })).toHaveAttribute('href', '/restaurants/1')
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout')
  })

  it('updates line total and summary when the quantity changes', async () => {
    await renderCart()

    await userEvent.click(screen.getByRole('button', { name: 'Add one more Filter Coffee' }))

    expect(screen.getByRole('group', { name: 'Quantity of Filter Coffee' })).toHaveTextContent('2')
    expect(screen.getByText('Rs. 260.00')).toBeInTheDocument()
  })

  it('removes a line with its Remove button', async () => {
    await renderCart()

    await userEvent.click(screen.getByRole('button', { name: 'Remove Filter Coffee from cart' }))

    expect(screen.queryByRole('heading', { name: 'Filter Coffee' })).not.toBeInTheDocument()
    expect(screen.getByText('Rs. 180.00')).toBeInTheDocument()
  })

  it('shows the empty state after the last line is removed', async () => {
    await renderCart()

    await userEvent.click(screen.getByRole('button', { name: 'Remove Masala Dosa from cart' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Filter Coffee from cart' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Your cart is on a diet' })).toBeInTheDocument()
  })

  it('keeps the cart when clearing is cancelled', async () => {
    await renderCart()
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }))

    await userEvent.click(screen.getByRole('button', { name: 'Keep my cart' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Masala Dosa' })).toBeInTheDocument()
  })

  it('empties the cart when clearing is confirmed', async () => {
    await renderCart()
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }))

    await userEvent.click(screen.getByRole('button', { name: 'Empty cart' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Your cart is on a diet' })).toBeInTheDocument()
    expect(screen.getByText('Cart emptied')).toBeInTheDocument()
  })

  it('has no accessibility violations with items in the cart', async () => {
    const { container } = await renderCart()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations when empty', async () => {
    const { container } = await renderCart({ seeded: false })

    expect(await axe(container)).toHaveNoViolations()
  })
})
