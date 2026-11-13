import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import * as ordersApi from '../api/orders.js'
import { setLatency } from '../api/testing.js'
import { store } from '../api/store.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'

const CART_KEY = 'campusbite.cart'

function seedCart(lines = [[1, 'Masala Dosa', 80, 2], [6, 'Filter Coffee', 40, 1]], restaurantId = 1, name = 'Dosa Dash') {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify({
      restaurantId,
      restaurantName: name,
      lines: Object.fromEntries(
        lines.map(([id, itemName, price, quantity]) => [id, { menu_item_id: id, name: itemName, unit_price: price, quantity }]),
      ),
    }),
  )
}

const storedLines = () => Object.keys(JSON.parse(localStorage.getItem(CART_KEY)).lines)

function renderCheckout() {
  return renderWithAuth(<App />, { entries: ['/checkout'] })
}

const address = () => screen.getByLabelText(/Delivery address/)
const payButton = () => screen.getByRole('button', { name: /Pay now \(dummy\)/ })

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
})

describe('Checkout page', () => {
  describe('access', () => {
    it('sends a guest to login and back to checkout with the cart intact', async () => {
      seedCart()
      renderCheckout()

      await userEvent.click(await screen.findByRole('button', { name: 'Fill Maya, hungry customer' }))
      await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Almost there' })).toBeInTheDocument()
      expect(screen.getByText('2 x Masala Dosa')).toBeInTheDocument()
    })

    it('redirects a guest to the login page first', async () => {
      seedCart()

      renderCheckout()

      expect(await screen.findByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument()
      expect(screen.queryByLabelText(/Delivery address/)).not.toBeInTheDocument()
    })

    it('sends a signed-in customer with an empty cart to the cart page', async () => {
      signInAs(1)

      renderCheckout()

      expect(await screen.findByRole('heading', { level: 1, name: 'Your cart is on a diet' })).toBeInTheDocument()
    })

    it('turns an owner away with a notice', async () => {
      signInAs(6)
      seedCart()

      renderCheckout()

      expect(await screen.findByText(/reserved for someone else/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Delivery address/)).not.toBeInTheDocument()
    })
  })

  describe('as a customer with a cart', () => {
    beforeEach(() => {
      signInAs(1)
      seedCart()
    })

    it('shows the order summary with the delivery fee and total', async () => {
      renderCheckout()

      expect(await screen.findByRole('heading', { name: 'Your order from Dosa Dash' })).toBeInTheDocument()
      expect(screen.getByText('2 x Masala Dosa')).toBeInTheDocument()
      expect(screen.getByText('Rs. 200.00', { selector: 'dd' })).toBeInTheDocument()
      expect(screen.getByText('Rs. 20.00', { selector: 'dd' })).toBeInTheDocument()
      expect(screen.getByText('Rs. 220.00', { selector: 'dd' })).toBeInTheDocument()
    })

    it('explains that the payment is a dummy', async () => {
      renderCheckout()

      expect(await screen.findByText(/Dummy payment: no real money moves/)).toBeInTheDocument()
    })

    it('shows an inline error and places no order when the address is empty', async () => {
      const placeOrder = vi.spyOn(ordersApi, 'placeOrder')
      renderCheckout()
      await screen.findByLabelText(/Delivery address/)

      await userEvent.click(payButton())

      expect(screen.getByText('Tell us where to bring the food.')).toBeInTheDocument()
      expect(address()).toHaveAttribute('aria-invalid', 'true')
      expect(placeOrder).not.toHaveBeenCalled()
    })

    it('asks for more detail when the address is too short', async () => {
      const placeOrder = vi.spyOn(ordersApi, 'placeOrder')
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'abc')

      await userEvent.click(payButton())

      expect(screen.getByText(/at least 5 characters/)).toBeInTheDocument()
      expect(placeOrder).not.toHaveBeenCalled()
    })

    it('places the order, clears the cart and lands on the confirmation', async () => {
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'Block C, Room 12')
      await userEvent.type(screen.getByLabelText(/Note for the kitchen/), 'No onions')

      await userEvent.click(payButton())

      expect(await screen.findByRole('heading', { level: 1, name: /order placed/i })).toBeInTheDocument()
      expect(screen.getByText('Paid (dummy)')).toBeInTheDocument()
      expect(screen.getByText('Block C, Room 12')).toBeInTheDocument()
      expect(screen.getByText('No onions')).toBeInTheDocument()
      expect(screen.getByText('Rs. 220.00', { selector: 'dd' })).toBeInTheDocument()
      expect(storedLines()).toEqual([])
      expect(store.orders).toHaveLength(1)
    })

    it('sends the api only ids and quantities, not prices', async () => {
      const placeOrder = vi.spyOn(ordersApi, 'placeOrder')
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'Block C, Room 12')

      await userEvent.click(payButton())

      await waitFor(() => expect(placeOrder).toHaveBeenCalledOnce())
      expect(placeOrder.mock.calls[0][0]).toMatchObject({
        restaurant_id: 1,
        items: [
          { menu_item_id: 1, quantity: 2 },
          { menu_item_id: 6, quantity: 1 },
        ],
        delivery_address: 'Block C, Room 12',
      })
      expect(placeOrder.mock.calls[0][0].items[0]).not.toHaveProperty('unit_price')
    })

    it('disables Pay while loading and places exactly one order on a double click', async () => {
      setLatency(30)
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'Block C, Room 12')

      await userEvent.dblClick(payButton())

      expect(payButton()).toBeDisabled()
      expect(await screen.findByRole('heading', { level: 1, name: /order placed/i })).toBeInTheDocument()
      expect(store.orders).toHaveLength(1)
    })

    it('shows the unavailable dish in an alert with a way back, and keeps the cart', async () => {
      store.menuItems.find((item) => item.id === 6).is_available = false
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'Block C, Room 12')

      await userEvent.click(payButton())

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Filter Coffee')
      expect(within(alert).getByRole('link', { name: 'Back to your cart' })).toHaveAttribute('href', '/cart')
      expect(storedLines()).toEqual(['1', '6'])
      expect(payButton()).toBeEnabled()
      expect(store.orders).toHaveLength(0)
    })

    it('shows the api message for other failures and keeps the cart', async () => {
      vi.spyOn(ordersApi, 'placeOrder').mockRejectedValueOnce(new Error('The till is on fire.'))
      renderCheckout()
      await userEvent.type(await screen.findByLabelText(/Delivery address/), 'Block C, Room 12')

      await userEvent.click(payButton())

      expect(await screen.findByRole('alert')).toHaveTextContent('The till is on fire.')
      expect(storedLines()).toEqual(['1', '6'])
    })

    it('has no accessibility violations', async () => {
      const { container } = renderCheckout()
      await screen.findByLabelText(/Delivery address/)

      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
