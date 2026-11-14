import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { store } from '../api/store.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import DeliveryOrderCard from './DeliveryOrderCard.jsx'

const orderById = (id) => structuredClone(store.orders.find((order) => order.id === id))

function renderCard(order, onDone = vi.fn()) {
  const view = renderWithAuth(<DeliveryOrderCard order={order} onDone={onDone} />)
  return { onDone, ...view }
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(3, 'DELIVERY_PARTNER')
})

describe('DeliveryOrderCard', () => {
  it('shows pickup, drop-off, first name only, item count and status', () => {
    renderCard(orderById(8))

    expect(screen.getByRole('heading', { name: 'Order #8' })).toBeInTheDocument()
    expect(screen.getByText('Noodle Nook')).toBeInTheDocument()
    expect(screen.getByText(store.orders.find((order) => order.id === 8).delivery_address)).toBeInTheDocument()
    expect(screen.getByText('Maya')).toBeInTheDocument()
    expect(screen.queryByText(/Patel/)).not.toBeInTheDocument()
    expect(screen.getByText('3 items')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })

  it('shows the customer note only when there is one', () => {
    const withNote = { ...orderById(8), note: 'Ring twice' }
    const { unmount } = renderCard(withNote)
    expect(screen.getByText('Ring twice')).toBeInTheDocument()
    unmount()

    renderCard({ ...orderById(8), note: '' })
    expect(screen.queryByText('Note')).not.toBeInTheDocument()
  })

  it('says 1 item for a single dish', () => {
    const order = orderById(8)
    renderCard({ ...order, items: [{ ...order.items[0], quantity: 1 }] })

    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it.each([
    [8, 'Pick up order for order #8'],
    [6, 'Mark delivered for order #6'],
  ])('offers the matching next step on order #%i', (id, name) => {
    renderCard(orderById(id))

    expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('offers no action on a delivered order', () => {
    renderCard(orderById(3))

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByText('Delivered')).toHaveLength(2)
  })

  it('picks up the order, toasts and reloads through onDone', async () => {
    const { onDone } = renderCard(orderById(8))

    await userEvent.click(screen.getByRole('button', { name: 'Pick up order for order #8' }))

    expect(await screen.findByText('Order #8 is on your bike. Ride safe.')).toBeInTheDocument()
    expect(store.orders.find((order) => order.id === 8).status).toBe('OUT_FOR_DELIVERY')
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('marks delivered and toasts', async () => {
    renderCard(orderById(6))

    await userEvent.click(screen.getByRole('button', { name: 'Mark delivered for order #6' }))

    expect(await screen.findByText('Delivered. Nice legwork.')).toBeInTheDocument()
    expect(store.orders.find((order) => order.id === 6).status).toBe('DELIVERED')
  })

  it('disables the button while the move is in flight', async () => {
    vi.spyOn(ordersApi, 'updateOrderStatus').mockReturnValue(new Promise(() => {}))
    renderCard(orderById(8))

    await userEvent.click(screen.getByRole('button', { name: 'Pick up order for order #8' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Pick up order for order #8' })).toBeDisabled())
  })

  it('toasts the error and still calls onDone when the move fails', async () => {
    const order = orderById(8)
    store.orders.find((candidate) => candidate.id === 8).status = 'DELIVERED'
    const { onDone } = renderCard(order)

    await userEvent.click(screen.getByRole('button', { name: 'Pick up order for order #8' }))

    expect(await screen.findByText(/cannot move to that step/i)).toBeInTheDocument()
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderCard(orderById(8))

    expect(await axe(container)).toHaveNoViolations()
  })
})
