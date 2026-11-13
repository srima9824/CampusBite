import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { store } from '../api/store.js'
import { formatMoney } from '../lib/formatMoney.js'
import { setLatency } from '../api/testing.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import DeliveryHistory from './DeliveryHistory.jsx'

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderHistory(path = '/delivery/history') {
  return renderWithAuth(
    <>
      <Routes>
        <Route element={<ProtectedRoute roles={['DELIVERY_PARTNER']} />}>
          <Route path="/delivery/history" element={<DeliveryHistory />} />
        </Route>
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { entries: [path] },
  )
}

const heading = () => screen.findByRole('heading', { level: 1, name: 'Delivery history' })
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const ids = () => rows().map((row) => within(row).getAllByRole('cell')[0].textContent)

function localDay(isoDate) {
  const date = new Date(isoDate)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(3, 'DELIVERY_PARTNER')
})

describe('DeliveryHistory page', () => {
  it('shows a loading state while history loads', async () => {
    setLatency(20)
    renderHistory()

    expect(await screen.findByRole('status', { name: 'Loading your delivery history' })).toBeInTheDocument()
    await screen.findByRole('table')
    expect(screen.queryByRole('status', { name: 'Loading your delivery history' })).not.toBeInTheDocument()
  })

  it('lists only Sam\'s delivered orders, newest first, with restaurant, address and total', async () => {
    renderHistory()

    await heading()
    await screen.findByRole('table')

    expect(ids()).toEqual(['#3', '#2', '#1'])
    const first = within(rows()[0])
    expect(first.getByText('Dosa Dash')).toBeInTheDocument()
    expect(first.getByText(store.orders.find((order) => order.id === 3).delivery_address)).toBeInTheDocument()
    expect(first.getByText(formatMoney(store.orders.find((order) => order.id === 3).total))).toBeInTheDocument()
  })

  it('always asks for DELIVERED and ignores a status in the URL', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')
    renderHistory('/delivery/history?status=READY')

    await screen.findByRole('table')

    expect(ids()).toEqual(['#3', '#2', '#1'])
    expect(listOrders.mock.calls.every(([query]) => query.status === 'DELIVERED')).toBe(true)
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })

  it('narrows by date range and keeps it in the URL', async () => {
    const oldest = localDay(store.orders.find((order) => order.id === 1).created_at)
    renderHistory()
    await screen.findByRole('table')

    await userEvent.type(screen.getByLabelText('To'), oldest)

    await waitFor(() => expect(ids()).toEqual(['#1']))
    expect(screen.getByTestId('where')).toHaveTextContent(`date_to=${oldest}`)
  })

  it('shows the filtered empty state and Clear filters restores the list', async () => {
    const today = localDay(new Date().toISOString())
    renderHistory(`/delivery/history?date_from=${today}`)

    expect(await screen.findByRole('heading', { name: 'No deliveries in those dates' })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(rows()).toHaveLength(3)
  })

  it('shows the first-delivery empty state to a partner who has delivered nothing (Jonah)', async () => {
    signInAs(5, 'DELIVERY_PARTNER')

    renderHistory()

    expect(await screen.findByRole('heading', { name: 'No finished drops yet' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an inline range error and does not send an inverted date range', async () => {
    const listOrders = vi.spyOn(ordersApi, 'listOrders')
    renderHistory('/delivery/history?date_from=2026-05-10&date_to=2026-05-01')

    await screen.findByRole('table')

    expect(screen.getByLabelText('To')).toHaveAccessibleDescription(/start date must not be after the end date/)
    expect(listOrders.mock.calls.every(([query]) => !query.date_from && !query.date_to)).toBe(true)
  })

  it('shows That page is empty past the last page and Back to first page recovers', async () => {
    renderHistory('/delivery/history?page=9')

    expect(await screen.findByRole('heading', { name: 'That page is empty' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back to first page' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ordersApi, 'listOrders').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderHistory()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    [1, 'CUSTOMER'],
    [6, 'OWNER'],
  ])('sends user %i (%s) away from the history', async (id, role) => {
    signInAs(id, role)

    renderHistory()

    expect(await screen.findByText('elsewhere')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderHistory()
    await screen.findByRole('table')

    expect(await axe(container)).toHaveNoViolations()
  })
})
