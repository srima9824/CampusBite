import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ownerApi from '../api/owner.js'
import * as restaurantsApi from '../api/restaurants.js'
import { store } from '../api/store.js'
import { setLatency } from '../api/testing.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OwnerMenu from './OwnerMenu.jsx'

function renderMenu() {
  return renderWithAuth(
    <Routes>
      <Route element={<ProtectedRoute roles={['OWNER']} />}>
        <Route path="/owner/menu" element={<OwnerMenu />} />
        <Route path="/owner/menu/new" element={<h1>Add page</h1>} />
        <Route path="/owner/menu/:itemId/edit" element={<h1>Edit page</h1>} />
      </Route>
    </Routes>,
    { entries: ['/owner/menu'] },
  )
}

const heading = () => screen.findByRole('heading', { level: 1, name: 'Dosa Dash menu' })
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const rowFor = (name) => rows().find((row) => within(row).getAllByRole('cell')[0].textContent.startsWith(name))
const switchIn = (row) => within(row).getByRole('checkbox')
const pressEscape = () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(6, 'OWNER')
})

describe('OwnerMenu page', () => {
  it('shows a loading state while the menu loads', async () => {
    setLatency(20)

    renderMenu()

    expect(await screen.findByRole('status', { name: 'Loading your menu' })).toBeInTheDocument()
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('lists the seven dishes of this restaurant only, with category, price and an Add item link', async () => {
    renderMenu()

    await heading()
    await screen.findByRole('table')
    expect(rows()).toHaveLength(7)
    expect(within(rowFor('Masala Dosa')).getByText('Dosas')).toBeInTheDocument()
    expect(within(rowFor('Masala Dosa')).getByText('Rs. 80.00')).toBeInTheDocument()
    expect(screen.queryByText('Veg Hakka Noodles')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Add item' })[0]).toHaveAttribute('href', '/owner/menu/new')
  })

  it('shows Sold out and an unchecked switch for an unavailable dish', async () => {
    renderMenu()
    await screen.findByRole('table')

    expect(within(rowFor('Cheese Dosa')).getByText('Sold out')).toBeInTheDocument()
    expect(switchIn(rowFor('Cheese Dosa'))).not.toBeChecked()
    expect(switchIn(rowFor('Masala Dosa'))).toBeChecked()
  })

  it('links Edit to the dish\'s edit page', async () => {
    renderMenu()
    await screen.findByRole('table')

    expect(within(rowFor('Masala Dosa')).getByRole('link', { name: /^Edit ?Masala Dosa$/ })).toHaveAttribute(
      'href',
      '/owner/menu/1/edit',
    )
  })

  describe('availability toggle', () => {
    it('flips at once, marks Sold out, and the store and public menu agree', async () => {
      renderMenu()
      await screen.findByRole('table')

      await userEvent.click(switchIn(rowFor('Masala Dosa')))

      expect(within(rowFor('Masala Dosa')).getByText('Sold out')).toBeInTheDocument()
      await waitFor(() => expect(store.menuItems.find((item) => item.id === 1).is_available).toBe(false))
      const menu = await restaurantsApi.listMenu(1)
      expect(menu.items.find((item) => item.id === 1).is_available).toBe(false)
    })

    it('puts the switch back and shows an error toast when the api refuses', async () => {
      vi.spyOn(ownerApi, 'setMenuItemAvailability').mockRejectedValueOnce(new Error('The pass is closed.'))
      renderMenu()
      await screen.findByRole('table')

      await userEvent.click(switchIn(rowFor('Masala Dosa')))

      expect(await screen.findByRole('alert')).toHaveTextContent('The pass is closed.')
      expect(switchIn(rowFor('Masala Dosa'))).toBeChecked()
      expect(within(rowFor('Masala Dosa')).queryByText('Sold out')).not.toBeInTheDocument()
    })
  })

  describe('deleting', () => {
    it('asks first and leaves the dish when kept', async () => {
      renderMenu()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Masala Dosa' }))

      expect(screen.getByRole('dialog', { name: 'Remove Masala Dosa from the menu?' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Keep dish' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(store.menuItems.some((item) => item.id === 1)).toBe(true)
      expect(rowFor('Masala Dosa')).toBeDefined()
    })

    it('leaves the dish when Escape cancels the dialog', async () => {
      renderMenu()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Masala Dosa' }))

      pressEscape()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(store.menuItems.some((item) => item.id === 1)).toBe(true)
    })

    it('removes the dish on confirm, toasts, refreshes the list and focuses the heading', async () => {
      renderMenu()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Masala Dosa' }))

      await userEvent.click(screen.getByRole('button', { name: 'Remove dish' }))

      expect(await screen.findByText('Masala Dosa removed from the menu')).toBeInTheDocument()
      await waitFor(() => expect(rows()).toHaveLength(6))
      expect(rowFor('Masala Dosa')).toBeUndefined()
      expect(store.menuItems.some((item) => item.id === 1)).toBe(false)
      expect(await heading()).toHaveFocus()
    })

    it('shows an error toast and closes the dialog when the delete fails', async () => {
      vi.spyOn(ownerApi, 'deleteMenuItem').mockRejectedValueOnce(new Error('The pass is closed.'))
      renderMenu()
      await userEvent.click(await screen.findByRole('button', { name: 'Delete Masala Dosa' }))

      await userEvent.click(screen.getByRole('button', { name: 'Remove dish' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('The pass is closed.')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows a blank-plate empty state with an Add item link when the menu is empty', async () => {
    store.menuItems = store.menuItems.filter((item) => item.restaurant_id !== 1)

    renderMenu()

    expect(await screen.findByRole('heading', { name: 'Your menu is a blank plate' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Add item' })).toHaveLength(2)
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(restaurantsApi, 'listMenu').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderMenu()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderMenu()
    await screen.findByRole('table')

    expect(await axe(container)).toHaveNoViolations()
  })
})
