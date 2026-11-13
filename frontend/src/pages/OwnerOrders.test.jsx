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
import OwnerOrders from './OwnerOrders.jsx'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderOwnerOrders(path = '/owner') {
  return renderWithAuth(
    <>
      <Routes>
        <Route element={<ProtectedRoute roles={['OWNER']} />}>
          <Route path="/owner" element={<OwnerOrders />} />
        </Route>
      </Routes>
      <Where />
    </>,
    { entries: [path] },
  )
}

const heading = () => screen.findByRole('heading', { level: 1, name: 'Dosa Dash orders' })
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const ids = () => rows().map((row) => within(row).getAllByRole('cell')[0].textContent)
const rowFor = (id) => rows().find((row) => within(row).getAllByRole('cell')[0].textContent === `#${id}`)

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(6, 'OWNER')
})

describe('OwnerOrders page', () => {
  it('shows a loading state while orders load', async () => {
    renderOwnerOrders()
    await heading()
    setLatency(20)
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PLACED')

    expect(await screen.findByRole('status', { name: 'Loading incoming orders' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(screen.queryByRole('status', { name: 'Loading incoming orders' })).not.toBeInTheDocument()
  })

  it('lists only this restaurant\'s six orders, newest first, under the restaurant heading', async () => {
    renderOwnerOrders()

    await heading()
    await screen.findByRole('table')
    expect(ids()).toEqual(['#15', '#14', '#11', '#7', '#3', '#1'])
    expect(within(rowFor(15)).getByText('Maya Patel')).toBeInTheDocument()
  })

  it('shows quantities, address and note in the items details', async () => {
    renderOwnerOrders()
    await screen.findByRole('table')

    const row = rowFor(3)

    expect(within(row).getByText('3 items')).toBeInTheDocument()
    expect(within(row).getByText('2 x Masala Dosa')).toBeInTheDocument()
    expect(within(row).getByText('Deliver to: Block C, Room 214, North Campus Hostel')).toBeInTheDocument()
    expect(within(row).getByText('Note: Extra chutney, please')).toBeInTheDocument()
  })

  it.each([
    [15, 'Accept order #15'],
    [11, 'Start preparing #11'],
  ])('offers the matching next step on order #%i', async (id, name) => {
    renderOwnerOrders()
    await screen.findByRole('table')

    expect(within(rowFor(id)).getByRole('button', { name })).toBeInTheDocument()
  })

  it('moves an order one step, toasts, updates the badge and focuses the heading', async () => {
    renderOwnerOrders()
    await userEvent.click(await screen.findByRole('button', { name: 'Accept order #15' }))

    expect(await screen.findByText('Order #15 is now accepted')).toBeInTheDocument()
    await waitFor(() => expect(within(rowFor(15)).getByText('Accepted')).toBeInTheDocument())
    expect(within(rowFor(15)).getByRole('button', { name: 'Start preparing #15' })).toBeInTheDocument()
    expect(await heading()).toHaveFocus()
  })

  it('assigns a rider to the READY order from the global pool', async () => {
    renderOwnerOrders()
    await screen.findByRole('table')
    await waitFor(() => expect(within(rowFor(7)).getByRole('option', { name: 'Jonah Reyes' })).toBeInTheDocument())

    await userEvent.selectOptions(within(rowFor(7)).getByRole('combobox'), 'Jonah Reyes')
    await userEvent.click(within(rowFor(7)).getByRole('button', { name: 'Assign rider to order #7' }))

    expect(await screen.findByText('Jonah Reyes will bring order #7')).toBeInTheDocument()
    await waitFor(() => expect(within(rowFor(7)).getByText('Rider: Jonah Reyes')).toBeInTheDocument())
  })

  it('narrows by status and keeps it in the URL', async () => {
    renderOwnerOrders()
    await screen.findByRole('table')

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PLACED')

    await waitFor(() => expect(ids()).toEqual(['#15', '#14']))
    expect(screen.getByTestId('where')).toHaveTextContent('/owner?status=PLACED')
  })

  it('starts from the filters in the URL', async () => {
    renderOwnerOrders('/owner?status=DELIVERED')

    await screen.findByRole('table')
    expect(screen.getByLabelText('Status')).toHaveValue('DELIVERED')
    expect(ids()).toEqual(['#3', '#1'])
  })

  it('shows the filtered empty state and Clear filters restores the list', async () => {
    renderOwnerOrders('/owner?status=CANCELLED')

    expect(await screen.findByRole('heading', { name: 'No orders match those filters' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(rows()).toHaveLength(6)
  })

  it('shows the first-order empty state to an owner with no orders (owner 5)', async () => {
    signInAs(10, 'OWNER')

    renderOwnerOrders()

    expect(await screen.findByRole('heading', { name: 'No orders yet, the oven is bored' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows That page is empty past the last page and Back to first page recovers', async () => {
    renderOwnerOrders('/owner?page=9')

    expect(await screen.findByRole('heading', { name: 'That page is empty' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to first page' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=')
  })

  it('shows an inline range error and does not send an inverted date range', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')

    renderOwnerOrders('/owner?date_from=2026-05-10&date_to=2026-05-01')

    await screen.findByRole('table')
    expect(screen.getByLabelText('To')).toHaveAccessibleDescription(/start date must not be after the end date/)
    expect(listOrders.mock.calls.every(([query]) => !query.date_from && !query.date_to)).toBe(true)
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ordersApi, 'listOrders').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderOwnerOrders()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the true status and an error toast when the order moved on elsewhere', async () => {
    renderOwnerOrders()
    const button = await screen.findByRole('button', { name: 'Accept order #15' })
    store.orders.find((order) => order.id === 15).status = 'ACCEPTED'

    await userEvent.click(button)

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot move to that step/)
    await waitFor(() => expect(within(rowFor(15)).getByText('Accepted')).toBeInTheDocument())
  })

  it('has no accessibility violations', async () => {
    const { container } = renderOwnerOrders()
    await screen.findByRole('table')

    expect(await axe(container)).toHaveNoViolations()
  })
})
