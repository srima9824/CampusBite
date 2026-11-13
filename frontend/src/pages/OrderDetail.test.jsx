import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { setLatency } from '../api/testing.js'
import { store } from '../api/store.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OrderDetail from './OrderDetail.jsx'

function renderDetail(orderId) {
  return renderWithAuth(
    <Routes>
      <Route path="/orders/:orderId" element={<OrderDetail />} />
      <Route path="/orders" element={<h1>Orders list</h1>} />
    </Routes>,
    { entries: [`/orders/${orderId}`] },
  )
}

const title = (id) => screen.findByRole('heading', { level: 1, name: `Order #${id}` })
const timelineItems = () => within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem')

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(1)
})

describe('OrderDetail page', () => {
  it('shows a loading state first', async () => {
    setLatency(20)

    renderDetail(8)

    expect(screen.getByRole('status', { name: 'Loading your order' })).toBeInTheDocument()
    expect(await screen.findByText('From Noodle Nook')).toBeInTheDocument()
  })

  it('shows the heading, restaurant, status, items, totals, address and payment', async () => {
    renderDetail(3)

    await title(3)
    expect(await screen.findByText('From Dosa Dash')).toBeInTheDocument()
    expect(screen.getAllByText('Delivered')).toHaveLength(2)
    expect(screen.getByText('Extra chutney, please')).toBeInTheDocument()
    expect(screen.getByText('Paid (dummy)')).toBeInTheDocument()
    expect(screen.getByText('2 x Masala Dosa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your orders' })).toHaveAttribute('href', '/orders')
  })

  it('shows the timeline with exactly one current step', async () => {
    renderDetail(8)

    await title(8)
    await screen.findByRole('list', { name: 'Order progress' })
    expect(timelineItems()).toHaveLength(6)
    expect(timelineItems().filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1)
    expect(timelineItems()[3]).toHaveTextContent('Ready')
    expect(timelineItems()[3]).toHaveTextContent('Now')
  })

  it('names the rider on an order that has one', async () => {
    renderDetail(8)

    expect(await screen.findByText('Sam Okafor')).toBeInTheDocument()
  })

  it('says there is no rider yet on an unassigned order', async () => {
    renderDetail(15)

    expect(await screen.findByText('No rider yet')).toBeInTheDocument()
  })

  it('shows a cancelled order\'s timeline ending on Cancelled', async () => {
    renderDetail(4)

    await screen.findByRole('list', { name: 'Order progress' })
    expect(timelineItems().at(-1)).toHaveTextContent('Cancelled')
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  })

  it.each([
    ['ACCEPTED', 12],
    ['READY', 8],
    ['DELIVERED', 3],
  ])('hides Cancel on a %s order', async (_status, id) => {
    renderDetail(id)

    await title(id)
    await screen.findByRole('list', { name: 'Order progress' })
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  })

  it('cancels a PLACED order after confirming and moves the timeline to Cancelled', async () => {
    renderDetail(15)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel order' }))

    expect(await screen.findByText('Order cancelled')).toBeInTheDocument()
    await waitFor(() => expect(timelineItems().at(-1)).toHaveTextContent('Cancelled'))
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
    expect(await title(15)).toHaveFocus()
  })

  it('keeps the order PLACED when the dialog is dismissed', async () => {
    renderDetail(15)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))

    await userEvent.click(screen.getByRole('button', { name: 'Keep order' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
  })

  it('shows what changed elsewhere after Refresh and announces Updated', async () => {
    renderDetail(15)
    await screen.findByText('From Dosa Dash')
    expect(screen.getByRole('status')).toHaveTextContent('')
    const kitchen = store.orders.find((order) => order.id === 15)
    kitchen.status = 'ACCEPTED'
    kitchen.status_history.push({ status: 'ACCEPTED', changed_at: new Date().toISOString() })

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(timelineItems()[1]).toHaveTextContent('Now'))
    expect(screen.getByRole('status')).toHaveTextContent('Updated')
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  })

  it('shows not-found for another customer\'s order', async () => {
    renderDetail(1)

    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that order' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your orders' })).toHaveAttribute('href', '/orders')
    expect(screen.queryByText('Paid (dummy)')).not.toBeInTheDocument()
  })

  it('shows not-found for an order that does not exist', async () => {
    renderDetail(999)

    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that order' })).toBeInTheDocument()
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ordersApi, 'getOrder').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderDetail(8)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('From Noodle Nook')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderDetail(15)
    await screen.findByText('From Dosa Dash')

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations on the not-found state', async () => {
    const { container } = renderDetail(1)
    await screen.findByRole('heading', { level: 1, name: 'We could not find that order' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
