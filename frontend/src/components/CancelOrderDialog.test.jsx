import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import CancelOrderDialog from './CancelOrderDialog.jsx'

function renderDialog(order = { id: 15 }) {
  const onClose = vi.fn()
  const onDone = vi.fn()
  renderWithAuth(<CancelOrderDialog order={order} onClose={onClose} onDone={onDone} />)
  return { onClose, onDone }
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(1)
})

describe('CancelOrderDialog', () => {
  it('asks to confirm with the order number and the warning', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Cancel order #15?' })).toBeInTheDocument()
    expect(screen.getByText(/only cancel before the restaurant accepts/)).toBeInTheDocument()
  })

  it('cancels the order, shows a success toast and tells the caller it is done', async () => {
    const { onDone } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(screen.getByText('Order cancelled')).toBeInTheDocument()
    expect((await ordersApi.getOrder(15)).status).toBe('CANCELLED')
  })

  it('does nothing to the order when the dialog is dismissed with Keep order', async () => {
    const { onClose, onDone } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Keep order' }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
    expect((await ordersApi.getOrder(15)).status).toBe('PLACED')
  })

  it('shows the api message in an error toast on 409 and still tells the caller so it can reload', async () => {
    const { onDone } = renderDialog({ id: 12 })

    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer be cancelled/)
    expect(screen.queryByText('Order cancelled')).not.toBeInTheDocument()
    expect((await ordersApi.getOrder(12)).status).toBe('ACCEPTED')
  })

  it('shows a fallback message when the failure carries none', async () => {
    vi.spyOn(ordersApi, 'cancelOrder').mockRejectedValueOnce({})
    const { onDone } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(screen.getByRole('alert')).toHaveTextContent('We could not cancel that order. Please try again.')
  })
})
