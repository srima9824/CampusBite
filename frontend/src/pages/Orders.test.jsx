import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { store } from '../api/store.js'
import { setLatency } from '../api/testing.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import Orders from './Orders.jsx'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderOrders(path = '/orders') {
  return renderWithAuth(
    <>
      <Routes>
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<h1>Detail page</h1>} />
      </Routes>
      <Where />
    </>,
    { entries: [path] },
  )
}

const heading = () => screen.findByRole('heading', { level: 1, name: 'Your orders' })
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const rowFor = (id) => rows().find((row) => within(row).queryByRole('link', { name: `#${id}` }))

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(1)
})

describe('Orders page', () => {
  it('shows a loading state while orders load', async () => {
    setLatency(20)

    renderOrders()

    expect(screen.getByRole('status', { name: 'Loading your orders' })).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading your orders' })).not.toBeInTheDocument()
  })

  it('lists Maya\'s seven orders newest first with text status badges', async () => {
    const { total } = await ordersApi.getOrder(15)
    renderOrders()

    await heading()
    await screen.findByRole('table')
    expect(rows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
      '#15', '#12', '#10', '#8', '#5', '#4', '#3',
    ])
    expect(within(rowFor(15)).getByText('Placed')).toBeInTheDocument()
    expect(within(rowFor(4)).getByText('Cancelled')).toBeInTheDocument()
    expect(within(rowFor(15)).getByText('2 items')).toBeInTheDocument()
    expect(within(rowFor(15)).getByText('Dosa Dash')).toBeInTheDocument()
    expect(within(rowFor(15)).getByText(`Rs. ${total.toFixed(2)}`)).toBeInTheDocument()
  })

  it('shows Leo his own, different orders', async () => {
    signInAs(2)

    renderOrders()

    await screen.findByRole('table')
    expect(rows()).toHaveLength(8)
    expect(rowFor(15)).toBeUndefined()
  })

  it('links each order number to its detail page', async () => {
    renderOrders()

    await userEvent.click(await screen.findByRole('link', { name: '#8' }))

    expect(await screen.findByRole('heading', { name: 'Detail page' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/orders/8')
  })

  it('offers Cancel only on PLACED rows', async () => {
    renderOrders()

    await screen.findByRole('table')
    expect(screen.getAllByRole('button', { name: /^Cancel order #/ })).toHaveLength(1)
    expect(within(rowFor(15)).getByRole('button', { name: 'Cancel order #15' })).toBeInTheDocument()
    expect(within(rowFor(12)).queryByRole('button')).not.toBeInTheDocument()
  })

  it('narrows the list by status and keeps it in the URL', async () => {
    renderOrders()
    await screen.findByRole('table')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'DELIVERED')

    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(rowFor(3)).toBeDefined()
    expect(screen.getByTestId('where')).toHaveTextContent('/orders?status=DELIVERED')
  })

  it('starts from the filters in the URL', async () => {
    renderOrders('/orders?status=CANCELLED')

    await screen.findByRole('table')
    expect(screen.getByLabelText('Status')).toHaveValue('CANCELLED')
    expect(rows()).toHaveLength(1)
    expect(rowFor(4)).toBeDefined()
  })

  it('ignores an unknown status in the URL', async () => {
    renderOrders('/orders?status=LOST')

    await screen.findByRole('table')
    expect(screen.getByLabelText('Status')).toHaveValue('')
    expect(rows()).toHaveLength(7)
  })

  it('filters by date range from the URL', async () => {
    const day = (iso) => {
      const date = new Date(iso)
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    const { created_at: oldest } = await ordersApi.getOrder(3)

    renderOrders(`/orders?date_from=${day(oldest)}&date_to=${day(oldest)}`)

    await screen.findByRole('table')
    expect(rows().map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['#3'])
  })

  it('shows the filtered empty state for Leo filtered to Cancelled, and Clear filters restores the list', async () => {
    signInAs(2)
    renderOrders('/orders?status=CANCELLED')

    expect(await screen.findByRole('heading', { name: 'No orders match those filters' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[1])

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(rows()).toHaveLength(8)
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/orders$/)
  })

  it('clears the filters from the filter bar', async () => {
    renderOrders('/orders?status=DELIVERED')
    await screen.findByRole('table')

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(rows()).toHaveLength(7))
    expect(screen.getByLabelText('Status')).toHaveValue('')
  })

  it('shows the first-order empty state with a way to browse for a new customer', async () => {
    store.users.push({ id: 99, name: 'New Student', email: 'new@campusbite.test', role: 'CUSTOMER', password: 'x' })
    signInAs(99)

    renderOrders()

    expect(await screen.findByRole('heading', { name: /No orders yet/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse restaurants' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows an inline range error and does not send an inverted date range', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')

    renderOrders('/orders?date_from=2026-05-10&date_to=2026-05-01')

    await screen.findByRole('table')
    expect(screen.getByLabelText('To')).toHaveAccessibleDescription(/start date must not be after the end date/)
    expect(rows()).toHaveLength(7)
    expect(listOrders.mock.calls.every(([query]) => !query.date_from && !query.date_to)).toBe(true)
  })

  it('pages ten orders at a time', async () => {
    for (let count = 0; count < 5; count += 1) {
      await ordersApi.placeOrder({
        restaurant_id: 1,
        items: [{ menu_item_id: 1, quantity: 1 }],
        delivery_address: 'Block C, Room 12',
      })
    }
    renderOrders()

    await screen.findByRole('table')
    expect(rows()).toHaveLength(10)
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.getByTestId('where')).toHaveTextContent('page=2')
  })

  it('shows That page is empty past the last page and Back to first page recovers', async () => {
    renderOrders('/orders?page=9')

    expect(await screen.findByRole('heading', { name: 'That page is empty' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to first page' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=')
  })

  it('keeps the status filter when going back from a page past the end', async () => {
    renderOrders('/orders?status=DELIVERED&page=4')

    await userEvent.click(await screen.findByRole('button', { name: 'Back to first page' }))

    await screen.findByRole('table')
    expect(screen.getByTestId('where')).toHaveTextContent('/orders?status=DELIVERED')
    expect(rows()).toHaveLength(1)
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ordersApi, 'listOrders').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderOrders()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('cancelling', () => {
    it('asks to confirm and leaves the order alone when kept', async () => {
      renderOrders()
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order #15' }))

      expect(screen.getByRole('dialog', { name: 'Cancel order #15?' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Keep order' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(within(rowFor(15)).getByText('Placed')).toBeInTheDocument()
    })

    it('turns the row Cancelled, drops its Cancel button, shows a toast and focuses the heading', async () => {
      renderOrders()
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel order #15' }))

      await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

      expect(await screen.findByText('Order cancelled')).toBeInTheDocument()
      await waitFor(() => expect(within(rowFor(15)).getByText('Cancelled')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /^Cancel order #/ })).not.toBeInTheDocument()
      expect(await heading()).toHaveFocus()
    })

    it('shows an error toast and the true status when the order moved on in the meantime', async () => {
      renderOrders()
      const button = await screen.findByRole('button', { name: 'Cancel order #15' })
      store.orders.find((order) => order.id === 15).status = 'ACCEPTED'

      await userEvent.click(button)
      await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/no longer be cancelled/)
      await waitFor(() => expect(within(rowFor(15)).getByText('Accepted')).toBeInTheDocument())
    })
  })

  it('has no accessibility violations', async () => {
    const { container } = renderOrders()
    await screen.findByRole('table')

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations in the filtered empty state', async () => {
    signInAs(2)
    const { container } = renderOrders('/orders?status=CANCELLED')
    await screen.findByRole('heading', { name: 'No orders match those filters' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
