import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ordersApi from '../api/orders.js'
import { store } from '../api/store.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OwnerOrderActions from './OwnerOrderActions.jsx'

const PARTNERS = [
  { id: 3, name: 'Sam Okafor' },
  { id: 4, name: 'Priya Nair' },
]

const orderById = (id) => structuredClone(store.orders.find((order) => order.id === id))

function renderActions(order, { partners = PARTNERS, onDone = vi.fn() } = {}) {
  renderWithAuth(<OwnerOrderActions order={order} partners={partners} onDone={onDone} />)
  return onDone
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(6, 'OWNER')
})

describe('OwnerOrderActions', () => {
  it.each([
    [14, 'Accept order #14'],
    [11, 'Start preparing #11'],
  ])('offers one button named for the next step on order #%i', (id, name) => {
    renderActions(orderById(id))

    expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('moves the order, shows a toast and reports back when the button is pressed', async () => {
    const onDone = renderActions(orderById(14))

    await userEvent.click(screen.getByRole('button', { name: 'Accept order #14' }))

    expect(await screen.findByText('Order #14 is now accepted')).toBeInTheDocument()
    expect(store.orders.find((order) => order.id === 14).status).toBe('ACCEPTED')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('shows the api message as an error toast and still reports back when the move is refused', async () => {
    const order = orderById(14)
    store.orders.find((candidate) => candidate.id === 14).status = 'ACCEPTED'
    const onDone = renderActions(order)

    await userEvent.click(screen.getByRole('button', { name: 'Accept order #14' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot move to that step/)
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('offers a rider select, no next step, and a disabled Assign rider on a READY order without a rider', () => {
    renderActions(orderById(7))

    const select = screen.getByRole('combobox', { name: 'Rider for order #7' })
    expect(select).toHaveValue('')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose a rider',
      'Sam Okafor',
      'Priya Nair',
    ])
    expect(screen.getByRole('button', { name: 'Assign rider to order #7' })).toBeDisabled()
  })

  it('assigns the chosen rider, toasts and reports back', async () => {
    const onDone = renderActions(orderById(7))

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rider for order #7' }), 'Priya Nair')
    await userEvent.click(screen.getByRole('button', { name: 'Assign rider to order #7' }))

    expect(await screen.findByText('Priya Nair will bring order #7')).toBeInTheDocument()
    expect(store.orders.find((order) => order.id === 7).delivery_partner_id).toBe(4)
    expect(onDone).toHaveBeenCalled()
  })

  it('shows the current rider and disables Assign until a different rider is picked', async () => {
    const order = orderById(7)
    order.delivery_partner_id = 3
    order.delivery_partner = { id: 3, name: 'Sam Okafor' }
    renderActions(order)

    expect(screen.getByText('Rider: Sam Okafor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assign rider to order #7' })).toBeDisabled()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rider for order #7' }), 'Priya Nair')

    expect(screen.getByRole('button', { name: 'Assign rider to order #7' })).toBeEnabled()
  })

  it('disables the rider select while the partner pool is still loading', () => {
    renderActions(orderById(7), { partners: null })

    expect(screen.getByRole('combobox', { name: 'Rider for order #7' })).toBeDisabled()
  })

  it('shows an error toast when the assignment fails', async () => {
    vi.spyOn(ordersApi, 'assignPartner').mockRejectedValueOnce(new Error('The rider is off shift.'))
    renderActions(orderById(7))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rider for order #7' }), 'Sam Okafor')

    await userEvent.click(screen.getByRole('button', { name: 'Assign rider to order #7' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The rider is off shift.')
  })

  it('says who has the order once it is out for delivery, with no controls', () => {
    renderActions(orderById(6))

    expect(screen.getByText('With rider Sam Okafor')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('renders nothing for a cancelled order with no rider', () => {
    renderActions(orderById(4))

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/rider/i)).not.toBeInTheDocument()
  })

  it('has no accessibility violations on the READY controls', async () => {
    const { container } = renderWithAuth(<OwnerOrderActions order={orderById(7)} partners={PARTNERS} onDone={vi.fn()} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
