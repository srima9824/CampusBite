import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { store } from '../api/store.js'
import { setLatency } from '../api/testing.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import DeliveryAssignments from './DeliveryAssignments.jsx'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderAssignments(path = '/delivery') {
  return renderWithAuth(
    <>
      <Routes>
        <Route element={<ProtectedRoute roles={['DELIVERY_PARTNER']} />}>
          <Route path="/delivery" element={<DeliveryAssignments />} />
        </Route>
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { entries: [path] },
  )
}

const heading = () => screen.findByRole('heading', { level: 1, name: 'Your deliveries' })
const cardTitles = () => screen.getAllByRole('heading', { level: 2 }).map((title) => title.textContent)

// Sam gets enough READY orders to need a second page.
function giveSamManyReadyOrders(count) {
  const template = store.orders.find((order) => order.id === 8)
  for (let index = 0; index < count; index += 1) {
    const id = store.nextOrderId
    store.nextOrderId += 1
    store.orders.push({ ...structuredClone(template), id, created_at: new Date(Date.now() + index * 1000).toISOString() })
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(3, 'DELIVERY_PARTNER')
})

describe('DeliveryAssignments page', () => {
  it('shows a loading state while deliveries load', async () => {
    setLatency(20)
    renderAssignments()

    expect(await screen.findByRole('status', { name: 'Loading your deliveries' })).toBeInTheDocument()
    await screen.findByRole('heading', { level: 2, name: 'Order #8' })
    expect(screen.queryByRole('status', { name: 'Loading your deliveries' })).not.toBeInTheDocument()
  })

  it('lists only Sam\'s READY and OUT_FOR_DELIVERY orders under All active by default', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')
    renderAssignments()

    await heading()
    await screen.findByRole('heading', { level: 2, name: 'Order #8' })

    expect(cardTitles()).toEqual(['Order #8', 'Order #6'])
    expect(screen.getByLabelText('Status')).toHaveValue('')
    expect(listOrders).toHaveBeenCalledWith(expect.objectContaining({ status: 'READY,OUT_FOR_DELIVERY' }))
  })

  it('offers only All active, Ready for pickup and Out for delivery, and no date filter', async () => {
    renderAssignments()
    await heading()

    expect(within(screen.getByLabelText('Status')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All active',
      'Ready for pickup',
      'Out for delivery',
    ])
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument()
  })

  it('narrows to one status and keeps it in the URL', async () => {
    renderAssignments()
    await screen.findByRole('heading', { level: 2, name: 'Order #8' })

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'OUT_FOR_DELIVERY')

    await waitFor(() => expect(cardTitles()).toEqual(['Order #6']))
    expect(screen.getByTestId('where')).toHaveTextContent('/delivery?status=OUT_FOR_DELIVERY')
  })

  it('falls back to All active for a status outside its list', async () => {
    renderAssignments('/delivery?status=DELIVERED')

    await screen.findByRole('heading', { level: 2, name: 'Order #8' })
    expect(screen.getByLabelText('Status')).toHaveValue('')
    expect(cardTitles()).toEqual(['Order #8', 'Order #6'])
  })

  it('picks up an order, toasts and then delivers it so the card leaves the list', async () => {
    renderAssignments()

    await userEvent.click(await screen.findByRole('button', { name: 'Pick up order for order #8' }))
    expect(await screen.findByText('Order #8 is on your bike. Ride safe.')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered for order #8' }))

    expect(await screen.findByText('Delivered. Nice legwork.')).toBeInTheDocument()
    await waitFor(() => expect(cardTitles()).toEqual(['Order #6']))
    expect(await heading()).toHaveFocus()
  })

  it('reloads from Refresh and announces the update', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')
    renderAssignments()
    await screen.findByRole('heading', { level: 2, name: 'Order #8' })
    const callsBefore = listOrders.mock.calls.length

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(listOrders.mock.calls.length).toBe(callsBefore + 1))
    expect(await screen.findByText('Updated')).toBeInTheDocument()
  })

  it('shows the quiet empty state to a partner with nothing assigned (Jonah)', async () => {
    signInAs(5, 'DELIVERY_PARTNER')

    renderAssignments()

    expect(await screen.findByRole('heading', { name: 'No drops right now, enjoy the quiet' })).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('offers Show all active when one status has nothing, and it restores the list', async () => {
    signInAs(4, 'DELIVERY_PARTNER')
    renderAssignments('/delivery?status=READY')

    expect(await screen.findByRole('heading', { name: 'No drops right now, enjoy the quiet' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show all active' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Order #5' })).toBeInTheDocument()
  })

  it('pages through a long list', async () => {
    giveSamManyReadyOrders(10)
    renderAssignments()
    await screen.findAllByRole('heading', { level: 2, name: /Order #/ })
    expect(screen.getAllByRole('article')).toHaveLength(10)

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2))
    expect(screen.getByTestId('where')).toHaveTextContent('page=2')
  })

  it('shows That page is empty past the last page and Back to first page recovers', async () => {
    renderAssignments('/delivery?page=9')

    expect(await screen.findByRole('heading', { name: 'That page is empty' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to first page' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Order #8' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=')
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ordersApi, 'listOrders').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderAssignments()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Order #8' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [1, 'CUSTOMER'],
    [6, 'OWNER'],
  ])('sends user %i (%s) away from /delivery', async (id, role) => {
    signInAs(id, role)

    renderAssignments()

    expect(await screen.findByText('elsewhere')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your deliveries' })).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderAssignments()
    await screen.findByRole('heading', { level: 2, name: 'Order #8' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
