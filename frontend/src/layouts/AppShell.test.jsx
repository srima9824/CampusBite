import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.jsx'
import { getSession } from '../api/session.js'
import { renderWithAuth, resetAuthWorld, signInAs } from '../test/helpers.jsx'

const nav = () => screen.getByRole('navigation', { name: 'Main' })
const linkNames = () => within(nav()).getAllByRole('link').map((link) => link.textContent)

beforeEach(resetAuthWorld)

describe('AppShell navigation', () => {
  it('shows Home, Log in and Sign up to a guest', () => {
    renderWithAuth(<App />)

    expect(linkNames()).toEqual(expect.arrayContaining(['Home', 'Cart', 'Log in', 'Sign up']))
    expect(within(nav()).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it.each([
    [1, 'Maya Patel', ['My orders', 'Cart']],
    [6, 'Owner 1', ['Orders', 'Stats', 'Menu']],
    [3, 'Sam Okafor', ['Deliveries']],
  ])('shows the role links, name and Log out for user %i', async (id, name, roleLinks) => {
    signInAs(id)

    renderWithAuth(<App />)

    expect(await within(nav()).findByText(name)).toBeInTheDocument()
    expect(linkNames()).toEqual(expect.arrayContaining(['Home', ...roleLinks]))
    expect(linkNames()).not.toContain('Log in')
    expect(linkNames()).not.toContain('Sign up')
    expect(within(nav()).getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it.each([
    [6, 'Owner 1'],
    [3, 'Sam Okafor'],
  ])('hides the Cart and My orders links from user %i (%s)', async (id, name) => {
    signInAs(id)

    renderWithAuth(<App />)

    await within(nav()).findByText(name)
    expect(linkNames()).not.toContain('Cart')
    expect(linkNames()).not.toContain('My orders')
  })

  it('names the item count in the Cart link once something is in the cart', () => {
    localStorage.setItem(
      'campusbite.cart',
      JSON.stringify({
        restaurantId: 1,
        restaurantName: 'Dosa Dash',
        lines: { 1: { menu_item_id: 1, name: 'Masala Dosa', unit_price: 80, quantity: 3 } },
      }),
    )

    renderWithAuth(<App />)

    expect(within(nav()).getByRole('link', { name: 'Cart, 3 items' })).toHaveAttribute('href', '/cart')
  })

  it('shows an owner exactly Orders, Stats and Menu with their routes', async () => {
    signInAs(6)

    renderWithAuth(<App />)

    await within(nav()).findByText('Owner 1')
    const role = ['Orders', 'Stats', 'Menu']
    expect(linkNames().filter((label) => role.includes(label))).toEqual(role)
    expect(within(nav()).getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/owner')
    expect(within(nav()).getByRole('link', { name: 'Stats' })).toHaveAttribute('href', '/owner/stats')
    expect(within(nav()).getByRole('link', { name: 'Menu' })).toHaveAttribute('href', '/owner/menu')
  })

  it.each([
    ['/owner', 'Orders'],
    ['/owner/stats', 'Stats'],
    ['/owner/menu', 'Menu'],
  ])('marks only the %s link as the current page', async (path, current) => {
    signInAs(6)

    renderWithAuth(<App />, { entries: [path] })

    await within(nav()).findByText('Owner 1')
    const marked = within(nav()).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(marked.map((link) => link.textContent)).toEqual([current])
  })

  it('hides Stats and Menu from a customer', async () => {
    signInAs(1)
    renderWithAuth(<App />)
    await within(nav()).findByText('Maya Patel')

    expect(linkNames()).not.toContain('Stats')
    expect(linkNames()).not.toContain('Menu')
  })

  it('hides owner links from a customer', async () => {
    signInAs(1)

    renderWithAuth(<App />)

    await within(nav()).findByText('Maya Patel')
    expect(linkNames()).not.toContain('Orders')
    expect(linkNames()).not.toContain('Deliveries')
    expect(within(nav()).getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/orders')
  })

  it('logs out, clears the session and returns to guest links', async () => {
    signInAs(1)
    renderWithAuth(<App />)
    await userEvent.click(await within(nav()).findByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(linkNames()).toContain('Log in'))
    expect(getSession()).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: /kitchen is still warming up/i })).toBeInTheDocument()
  })

  it('returns to the home page when logging out from a protected page', async () => {
    signInAs(6)
    renderWithAuth(<App />, { entries: ['/owner'] })
    await userEvent.click(await within(nav()).findByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(linkNames()).toContain('Log in'))
    expect(screen.getByRole('heading', { level: 1, name: /kitchen is still warming up/i })).toBeInTheDocument()
  })
})
