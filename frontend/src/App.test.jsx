import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.jsx'
import { renderWithAuth, resetAuthWorld, signInAs } from './test/helpers.jsx'

beforeEach(resetAuthWorld)

describe('App routing with auth', () => {
  it.each(['/owner', '/delivery'])('sends a guest from %s to the login page', async (path) => {
    renderWithAuth(<App />, { entries: [path] })

    expect(await screen.findByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument()
  })

  it.each(['/orders', '/orders/1'])('sends a guest from %s to the login page', async (path) => {
    renderWithAuth(<App />, { entries: [path] })

    expect(await screen.findByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument()
  })

  it('shows a customer their order history at /orders', async () => {
    signInAs(1)

    renderWithAuth(<App />, { entries: ['/orders'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Your orders' })).toBeInTheDocument()
  })

  it('shows a customer their own order at /orders/:orderId', async () => {
    signInAs(1)

    renderWithAuth(<App />, { entries: ['/orders/3'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Order #3' })).toBeInTheDocument()
  })

  it('keeps an owner out of /orders', async () => {
    signInAs(6)

    renderWithAuth(<App />, { entries: ['/orders'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash orders' })).toBeInTheDocument()
  })

  it('shows an owner their orders dashboard at /owner', async () => {
    signInAs(6)

    renderWithAuth(<App />, { entries: ['/owner'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash orders' })).toBeInTheDocument()
  })

  it.each([
    ['/owner/stats', 'Dosa Dash stats'],
    ['/owner/menu', 'Dosa Dash menu'],
    ['/owner/menu/new', 'Add a dish'],
    ['/owner/menu/1/edit', 'Edit dish'],
  ])('shows an owner the page at %s', async (path, name) => {
    signInAs(6)

    renderWithAuth(<App />, { entries: [path] })

    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument()
  })

  it.each(['/owner/stats', '/owner/menu', '/owner/menu/new'])('sends a guest from %s to the login page', async (path) => {
    renderWithAuth(<App />, { entries: [path] })

    expect(await screen.findByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument()
  })

  it.each(['/owner/stats', '/owner/menu'])('keeps a customer out of %s', async (path) => {
    signInAs(1)

    renderWithAuth(<App />, { entries: [path] })

    expect(await screen.findByText(/reserved for someone else/i)).toBeInTheDocument()
  })

  it('shows the deliveries page to a delivery partner at /delivery', async () => {
    signInAs(3)

    renderWithAuth(<App />, { entries: ['/delivery'] })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your deliveries')
  })

  it('sends a customer from /owner home with a visible notice', async () => {
    signInAs(1)

    renderWithAuth(<App />, { entries: ['/owner'] })

    expect(await screen.findByText(/reserved for someone else/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: /pick your kitchen/i })).toBeInTheDocument()
  })

  it('sends a delivery partner away from /owner to /delivery', async () => {
    signInAs(3)

    renderWithAuth(<App />, { entries: ['/owner'] })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Your deliveries')
  })

  it('redirects a signed-in user away from login to their home', async () => {
    signInAs(6)

    renderWithAuth(<App />, { entries: ['/login'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash orders' })).toBeInTheDocument()
  })

  it('redirects a signed-in user away from register to their home', async () => {
    signInAs(1)

    renderWithAuth(<App />, { entries: ['/register'] })

    expect(await screen.findByRole('heading', { level: 1, name: /pick your kitchen/i })).toBeInTheDocument()
  })

  it('still shows not-found for an unknown path', () => {
    renderWithAuth(<App />, { entries: ['/no-such-dish'] })

    expect(screen.getByRole('heading', { level: 1, name: /left the table/i })).toBeInTheDocument()
  })
})

describe('App routes', () => {
  it('shows the home heading at /', async () => {
    renderWithAuth(<App />, { entries: ['/'] })

    expect(await screen.findByRole('heading', { level: 1, name: 'Hungry? Pick a kitchen.' })).toBeInTheDocument()
  })

  it('shows the not-found state for an unknown path', async () => {
    renderWithAuth(<App />, { entries: ['/no-such-dish'] })

    expect(await screen.findByRole('heading', { level: 1, name: /left the table/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to the kitchen/i })).toHaveAttribute('href', '/')
  })

  it('wraps pages in the shell with a skip link and navigation', () => {
    renderWithAuth(<App />, { entries: ['/'] })

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })
})
