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

    expect(await screen.findByRole('heading', { level: 1, name: /kitchen is being prepped/i })).toBeInTheDocument()
  })

  it('shows the owner placeholder to an owner at /owner', async () => {
    signInAs(6)

    renderWithAuth(<App />, { entries: ['/owner'] })

    expect(await screen.findByRole('heading', { level: 1, name: /kitchen is being prepped/i })).toBeInTheDocument()
  })

  it('shows the delivery placeholder to a delivery partner at /delivery', async () => {
    signInAs(3)

    renderWithAuth(<App />, { entries: ['/delivery'] })

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/route/i)
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

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/route/i)
  })

  it('redirects a signed-in user away from login to their home', async () => {
    signInAs(6)

    renderWithAuth(<App />, { entries: ['/login'] })

    expect(await screen.findByRole('heading', { level: 1, name: /kitchen is being prepped/i })).toBeInTheDocument()
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
