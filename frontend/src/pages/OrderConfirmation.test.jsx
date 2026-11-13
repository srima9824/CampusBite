import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { setLatency } from '../api/testing.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OrderConfirmation from './OrderConfirmation.jsx'

const placeMaya = () =>
  ordersApi.placeOrder({
    restaurant_id: 1,
    items: [{ menu_item_id: 1, quantity: 2 }],
    delivery_address: 'Block C, Room 12',
    note: 'No chutney',
  })

function renderConfirmation(orderId) {
  return renderWithAuth(
    <Routes>
      <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
    </Routes>,
    { entries: [`/order-confirmation/${orderId}`] },
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(1)
})

describe('OrderConfirmation page', () => {
  it('shows a loading state while the order loads', async () => {
    const order = await placeMaya()
    setLatency(20)

    renderConfirmation(order.id)

    expect(screen.getByRole('status', { name: 'Loading your order' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('shows the order number, restaurant and a Placed badge', async () => {
    const order = await placeMaya()

    renderConfirmation(order.id)

    expect(await screen.findByRole('heading', { level: 1, name: /order placed/i })).toBeInTheDocument()
    expect(screen.getByText(`Order #${order.id} from Dosa Dash`)).toBeInTheDocument()
    expect(screen.getByText('Placed')).toBeInTheDocument()
  })

  it('shows the lines and the totals the api returned', async () => {
    const order = await placeMaya()

    renderConfirmation(order.id)

    expect(await screen.findByText('2 x Masala Dosa')).toBeInTheDocument()
    expect(screen.getByText('Rs. 160.00', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByText('Rs. 180.00')).toBeInTheDocument()
  })

  it('shows the address, note and the dummy payment line', async () => {
    const order = await placeMaya()

    renderConfirmation(order.id)

    expect(await screen.findByText('Block C, Room 12')).toBeInTheDocument()
    expect(screen.getByText('No chutney')).toBeInTheDocument()
    expect(screen.getByText('Paid (dummy)')).toBeInTheDocument()
  })

  it('links onward to order more', async () => {
    const order = await placeMaya()

    renderConfirmation(order.id)

    expect(await screen.findByRole('link', { name: 'Order more' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows not-found for an order that does not exist', async () => {
    renderConfirmation(999)

    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that order' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse restaurants' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows not-found for another customer\'s order', async () => {
    signInAs(2)
    const leosOrder = await placeMaya()
    signInAs(1)

    renderConfirmation(leosOrder.id)

    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that order' })).toBeInTheDocument()
    expect(screen.queryByText('Paid (dummy)')).not.toBeInTheDocument()
  })

  it('shows an error with Retry that recovers', async () => {
    const order = await placeMaya()
    vi.spyOn(ordersApi, 'getOrder').mockRejectedValueOnce(new Error('The kitchen phone is busy.'))

    renderConfirmation(order.id)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The kitchen phone is busy.')
    alert.querySelector('button').click()
    expect(await screen.findByRole('heading', { level: 1, name: /order placed/i })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const order = await placeMaya()

    const { container } = renderConfirmation(order.id)
    await screen.findByRole('heading', { level: 1, name: /order placed/i })

    expect(await axe(container)).toHaveNoViolations()
  })
})
