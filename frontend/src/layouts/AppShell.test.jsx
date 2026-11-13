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

    expect(linkNames()).toEqual(expect.arrayContaining(['Home', 'Log in', 'Sign up']))
    expect(within(nav()).queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it.each([
    [1, 'Maya Patel', []],
    [6, 'Owner 1', ['Orders']],
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

  it('hides owner links from a customer', async () => {
    signInAs(1)

    renderWithAuth(<App />)

    await within(nav()).findByText('Maya Patel')
    expect(linkNames()).not.toContain('Orders')
    expect(linkNames()).not.toContain('Deliveries')
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
