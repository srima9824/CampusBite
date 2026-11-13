import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ownerApi from '../api/owner.js'
import { updateOrderStatus } from '../api/orders.js'
import { setLatency } from '../api/testing.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OwnerStats from './OwnerStats.jsx'

function renderStats() {
  return renderWithAuth(
    <Routes>
      <Route element={<ProtectedRoute roles={['OWNER']} />}>
        <Route path="/owner/stats" element={<OwnerStats />} />
        <Route path="/owner" element={<h1>Orders page</h1>} />
      </Route>
    </Routes>,
    { entries: ['/owner/stats'] },
  )
}

const card = (label) => screen.getByText(label, { selector: 'dt' }).parentElement

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(6, 'OWNER')
})

describe('OwnerStats page', () => {
  it('shows a loading state, then the restaurant heading and four cards', async () => {
    renderStats()

    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash stats' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading your numbers' })).not.toBeInTheDocument())
    expect(within(card('Total orders')).getAllByRole('definition')[0]).toHaveTextContent('6')
    expect(within(card('Waiting for you')).getAllByRole('definition')[0]).toHaveTextContent('2')
    expect(card('Revenue')).toHaveTextContent('Cancelled orders not counted')
    expect(card('Orders today')).toBeInTheDocument()
  })

  it('shows the loading skeleton while the numbers are fetched', async () => {
    setLatency(30)

    renderStats()

    expect(await screen.findByRole('status', { name: 'Loading your numbers' })).toBeInTheDocument()
    expect(await screen.findByText('Total orders')).toBeInTheDocument()
  })

  it('lists every status in the by-status bars and the top sellers with numbers as text', async () => {
    renderStats()

    const byStatus = await screen.findByRole('list', { name: 'Orders by status' })
    expect(within(byStatus).getAllByRole('listitem')).toHaveLength(7)
    expect(within(byStatus).getByText('Placed').parentElement).toHaveTextContent('Placed2')
    const sellers = screen.getByRole('list', { name: 'Top sellers by quantity' })
    expect(within(sellers).getAllByRole('listitem')[0]).toHaveTextContent('Idli Sambar3')
  })

  it('shows new numbers and announces Updated after an order moves and Refresh is pressed', async () => {
    renderStats()
    await screen.findByText('Total orders')
    expect(within(card('Waiting for you')).getAllByRole('definition')[0]).toHaveTextContent('2')
    await updateOrderStatus(14, { status: 'ACCEPTED' })

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(within(card('Waiting for you')).getAllByRole('definition')[0]).toHaveTextContent('1'))
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Updated')
  })

  it('shows an empty state with a link to orders for an owner with no orders', async () => {
    signInAs(10, 'OWNER')

    renderStats()

    expect(await screen.findByRole('heading', { name: 'Nothing to count yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to orders' })).toHaveAttribute('href', '/owner')
    expect(screen.queryByRole('list', { name: 'Orders by status' })).not.toBeInTheDocument()
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(ownerApi, 'getRestaurantStats').mockRejectedValueOnce(new Error('The ledger is locked.'))
    renderStats()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The ledger is locked.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Total orders')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderStats()
    await screen.findByText('Total orders')

    expect(await axe(container)).toHaveNoViolations()
  })
})
