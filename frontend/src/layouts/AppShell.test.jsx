import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
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
    [3, 'Sam Okafor', ['Deliveries', 'History']],
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
    expect(screen.getByRole('heading', { level: 1, name: 'Hungry? Pick a kitchen.' })).toBeInTheDocument()
  })

  it('returns to the home page when logging out from a protected page', async () => {
    signInAs(6)
    renderWithAuth(<App />, { entries: ['/owner'] })
    await userEvent.click(await within(nav()).findByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(linkNames()).toContain('Log in'))
    expect(screen.getByRole('heading', { level: 1, name: 'Hungry? Pick a kitchen.' })).toBeInTheDocument()
  })

  it('opens the delivery history from the History link and marks it current', async () => {
    signInAs(3, 'DELIVERY_PARTNER')
    renderWithAuth(<App />, { entries: ['/delivery'] })

    await userEvent.click(await within(nav()).findByRole('link', { name: 'History' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Delivery history' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav()).getByRole('link', { name: 'Deliveries' })).not.toHaveAttribute('aria-current')
  })
})

const footer = () => screen.getByRole('navigation', { name: 'Footer' })
const footerNames = () => within(footer()).getAllByRole('link').map((link) => link.textContent)

describe('AppShell styleguide link', () => {
  it.each([
    ['a guest', null],
    ['a customer', 1],
    ['an owner', 6],
    ['a delivery partner', 3],
  ])('is absent from the header and footer for %s', async (_who, id) => {
    if (id) signInAs(id)

    renderWithAuth(<App />)
    if (id) await within(nav()).findByRole('button', { name: 'Log out' })

    expect(screen.queryByRole('link', { name: /styleguide/i })).not.toBeInTheDocument()
  })

  it('still renders the styleguide page at its URL', () => {
    renderWithAuth(<App />, { entries: ['/styleguide'] })

    expect(screen.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeInTheDocument()
  })
})

describe('AppShell profile chip', () => {
  it.each([
    [1, 'Maya Patel', 'Customer'],
    [6, 'Owner 1', 'Owner'],
    [3, 'Sam Okafor', 'Delivery partner'],
  ])('shows the name and role label of user %i', async (id, name, role) => {
    signInAs(id)

    renderWithAuth(<App />)

    const chip = (await within(nav()).findByText(name)).closest('[class*="_profile_"]')
    expect(chip).toHaveTextContent(`Signed in as ${name}, ${role}`)
  })

  it('keeps the chip apart from the Log out button', async () => {
    signInAs(1)
    renderWithAuth(<App />)

    const logOut = await within(nav()).findByRole('button', { name: 'Log out' })
    const chip = within(nav()).getByText('Maya Patel').closest('[class*="_profile_"]')

    expect(chip).not.toContainElement(logOut)
    expect(logOut).not.toHaveTextContent('Maya')
    expect(chip.closest('button, a')).toBeNull()
  })

  it('shows no chip to a guest', () => {
    renderWithAuth(<App />)

    expect(within(nav()).queryByText(/signed in as/i)).not.toBeInTheDocument()
  })
})

describe('AppShell footer', () => {
  it('shows the brand, tagline and description', () => {
    renderWithAuth(<App />)

    expect(screen.getByText('Order between lectures, eat before the bell.')).toBeInTheDocument()
    expect(screen.getByText(/brings your campus kitchens to one tap/i)).toBeInTheDocument()
    expect(within(footer()).getByText('Quick links')).toBeInTheDocument()
  })

  it('lists the guest links', () => {
    renderWithAuth(<App />)

    expect(footerNames()).toEqual(['Restaurants', 'Cart', 'Log in', 'Sign up'])
  })

  it.each([
    [1, 'Maya Patel', ['Restaurants', 'My orders', 'Cart']],
    [6, 'Owner 1', ['Orders', 'Stats', 'Menu']],
    [3, 'Sam Okafor', ['Deliveries', 'History']],
  ])('lists only the role links for user %i', async (id, name, labels) => {
    signInAs(id)

    renderWithAuth(<App />)

    await within(nav()).findByText(name)
    expect(footerNames()).toEqual(labels)
  })

  it('points every footer link at the same route as the header link of that name', async () => {
    signInAs(1)
    renderWithAuth(<App />)
    await within(nav()).findByText('Maya Patel')

    for (const link of within(footer()).getAllByRole('link')) {
      expect(within(nav()).getByRole('link', { name: link.textContent })).toHaveAttribute(
        'href',
        link.getAttribute('href'),
      )
    }
  })

  it('shows the current year in the copyright line', () => {
    renderWithAuth(<App />)

    expect(
      screen.getByText(`\u00a9 ${new Date().getFullYear()} CampusBite. Made by students, for students.`),
    ).toBeInTheDocument()
  })

  it('computes the year at render time', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-06-01T00:00:00Z'))

    renderWithAuth(<App />)

    expect(screen.getByText(/\u00a9 2031 CampusBite/)).toBeInTheDocument()
  })

  it('no longer shows the old closing line', () => {
    renderWithAuth(<App />)

    expect(screen.queryByText(/seconds not included/i)).not.toBeInTheDocument()
  })
})

describe('AppShell layout', () => {
  afterEach(() => vi.useRealTimers())

  it('wraps the page in the shell with a main landmark that the skip link targets', () => {
    const { container } = renderWithAuth(<App />)

    expect(container.firstChild.className).toMatch(/shell/)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getByRole('main').className).toMatch(/main/)
  })

  it('has the header, main and footer landmarks in order', () => {
    renderWithAuth(<App />)

    const [header, main, contentinfo] = [
      screen.getByRole('banner'),
      screen.getByRole('main'),
      screen.getByRole('contentinfo'),
    ]
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(main.compareDocumentPosition(contentinfo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has no accessibility violations for a signed-in user', async () => {
    signInAs(1)
    const { container } = renderWithAuth(<App />, { entries: ['/orders'] })
    await within(nav()).findByText('Maya Patel')

    expect(await axe(container)).toHaveNoViolations()
  })
})
