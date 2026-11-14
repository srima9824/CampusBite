import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ownerApi from '../api/owner.js'
import * as restaurantsApi from '../api/restaurants.js'
import { store } from '../api/store.js'
import ProtectedRoute from '../routes/ProtectedRoute.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'
import OwnerMenuItemEdit from './OwnerMenuItemEdit.jsx'

function renderPage(path) {
  return renderWithAuth(
    <Routes>
      <Route element={<ProtectedRoute roles={['OWNER']} />}>
        <Route path="/owner/menu" element={<h1>Menu list</h1>} />
        <Route path="/owner/menu/new" element={<OwnerMenuItemEdit />} />
        <Route path="/owner/menu/:itemId/edit" element={<OwnerMenuItemEdit />} />
      </Route>
    </Routes>,
    { entries: [path] },
  )
}

const name = () => screen.findByLabelText('Name')

beforeEach(() => {
  vi.restoreAllMocks()
  resetAuthWorld()
  signInAs(6, 'OWNER')
})

describe('add page', () => {
  it('shows the Add a dish form with existing categories as suggestions', async () => {
    const { container } = renderPage('/owner/menu/new')

    expect(await screen.findByRole('heading', { level: 1, name: 'Add a dish' })).toBeInTheDocument()
    await name()
    expect([...container.querySelectorAll('datalist option')].map((option) => option.value)).toEqual([
      'Dosas',
      'Breakfast',
      'Drinks',
    ])
    expect(screen.getByRole('link', { name: 'Back to menu' })).toHaveAttribute('href', '/owner/menu')
  })

  it('creates the dish, toasts and returns to the list', async () => {
    renderPage('/owner/menu/new')
    await userEvent.type(await name(), 'Test Dosa')
    await userEvent.type(screen.getByLabelText('Category'), 'Dosas')
    await userEvent.type(screen.getByLabelText('Price (Rs.)'), '99.50')

    await userEvent.click(screen.getByRole('button', { name: 'Add to menu' }))

    expect(await screen.findByRole('heading', { name: 'Menu list' })).toBeInTheDocument()
    expect(await screen.findByText('Test Dosa added to the menu')).toBeInTheDocument()
    const menu = await restaurantsApi.listMenu(1)
    expect(menu.items.find((item) => item.name === 'Test Dosa')).toMatchObject({ price: 99.5, restaurant_id: 1 })
  })

  it('shows per-field messages and makes no api call when the form is empty', async () => {
    const create = vi.spyOn(ownerApi, 'createMenuItem')
    renderPage('/owner/menu/new')
    await name()

    await userEvent.click(screen.getByRole('button', { name: 'Add to menu' }))

    expect(screen.getByLabelText('Price (Rs.)')).toHaveAccessibleDescription(/price above 0/)
    expect(await name()).toHaveFocus()
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the duplicate-name message under Name and stays on the page', async () => {
    renderPage('/owner/menu/new')
    await userEvent.type(await name(), 'Masala Dosa')
    await userEvent.type(screen.getByLabelText('Category'), 'Dosas')
    await userEvent.type(screen.getByLabelText('Price (Rs.)'), '80')

    await userEvent.click(screen.getByRole('button', { name: 'Add to menu' }))

    expect(await screen.findByText('Your menu already has a dish with that name.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Add a dish' })).toBeInTheDocument()
  })

  it('goes back to the list from Cancel', async () => {
    renderPage('/owner/menu/new')
    await name()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('heading', { name: 'Menu list' })).toBeInTheDocument()
  })
})

describe('edit page', () => {
  it('prefills the form with the dish', async () => {
    renderPage('/owner/menu/2/edit')

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit dish' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ghee Roast Dosa'))
    expect(screen.getByLabelText('Price (Rs.)')).toHaveValue('110')
    expect(screen.getByLabelText('Category')).toHaveValue('Dosas')
  })

  it('saves a new price, toasts and returns to the list', async () => {
    renderPage('/owner/menu/2/edit')
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ghee Roast Dosa'))
    const price = screen.getByLabelText('Price (Rs.)')
    await userEvent.clear(price)
    await userEvent.type(price, '125')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Ghee Roast Dosa updated')).toBeInTheDocument()
    expect(store.menuItems.find((item) => item.id === 2).price).toBe(125)
    expect(screen.getByRole('heading', { name: 'Menu list' })).toBeInTheDocument()
  })

  it('shows That dish is not on your menu for another restaurant\'s item', async () => {
    renderPage('/owner/menu/8/edit')

    expect(await screen.findByRole('heading', { name: 'That dish is not on your menu' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('shows the same message for an item id that does not exist', async () => {
    renderPage('/owner/menu/999/edit')

    expect(await screen.findByRole('heading', { name: 'That dish is not on your menu' })).toBeInTheDocument()
  })

  it('shows an error with Retry that recovers', async () => {
    vi.spyOn(restaurantsApi, 'listMenu').mockRejectedValueOnce(new Error('The pass is closed.'))
    renderPage('/owner/menu/2/edit')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The pass is closed.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ghee Roast Dosa'))
  })

  it('has no accessibility violations', async () => {
    const { container } = renderPage('/owner/menu/2/edit')
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Ghee Roast Dosa'))

    expect(await axe(container)).toHaveNoViolations()
  })
})
