import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.jsx'
import { setLatency } from '../api/testing.js'
import { DEMO_PASSWORD, renderWithAuth, resetAuthWorld } from '../test/helpers.jsx'

const email = () => screen.getByLabelText('Email')
const password = () => screen.getByLabelText('Password')
const submit = () => screen.getByRole('button', { name: 'Log in' })

function renderLogin(entries = ['/login']) {
  return renderWithAuth(<App />, { entries })
}

async function logInWith(address, secret) {
  await userEvent.type(email(), address)
  await userEvent.type(password(), secret)
  await userEvent.click(submit())
}

beforeEach(resetAuthWorld)

describe('Login page', () => {
  it('labels the email and password fields and links to register', () => {
    renderLogin()

    expect(email()).toBeInTheDocument()
    expect(password()).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })

  it('shows field errors and focuses the email when submitted empty', async () => {
    renderLogin()

    await userEvent.click(submit())

    expect(email()).toHaveAccessibleDescription(/enter your email/i)
    expect(password()).toHaveAccessibleDescription(/enter your password/i)
    expect(email()).toHaveFocus()
  })

  it('focuses the password when only it is missing', async () => {
    renderLogin()
    await userEvent.type(email(), 'maya@campusbite.test')

    await userEvent.click(submit())

    expect(password()).toHaveFocus()
    expect(email()).not.toHaveAttribute('aria-invalid')
  })

  it('shows an alert and keeps the email when the password is wrong', async () => {
    renderLogin()

    await logInWith('maya@campusbite.test', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(email()).toHaveValue('maya@campusbite.test')
    expect(submit()).toBeEnabled()
  })

  it('disables the button while signing in', async () => {
    setLatency(50)
    renderLogin()
    await userEvent.type(email(), 'maya@campusbite.test')
    await userEvent.type(password(), DEMO_PASSWORD)

    await userEvent.click(submit())

    expect(screen.getByRole('button', { name: 'Logging in' })).toBeDisabled()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Logging in' })).not.toBeInTheDocument())
  })

  it.each([
    ['maya@campusbite.test', /pick your kitchen/i],
    ['owner1@campusbite.test', 'Dosa Dash orders'],
    ['sam@campusbite.test', /route/i],
  ])('lands %s on their role home after login', async (address, heading) => {
    renderLogin()

    await logInWith(address, DEMO_PASSWORD)

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('returns a guest to the page they first asked for', async () => {
    renderLogin(['/delivery'])
    await screen.findByRole('heading', { level: 1, name: /welcome back/i })

    await logInWith('sam@campusbite.test', DEMO_PASSWORD)

    expect(await screen.findByRole('heading', { level: 1, name: /route/i })).toBeInTheDocument()
  })

  it.each([
    ['Fill Maya, hungry customer', 'maya@campusbite.test'],
    ['Fill Owner of Dosa Dash', 'owner1@campusbite.test'],
    ['Fill Sam, delivery partner', 'sam@campusbite.test'],
  ])('fills the form from the "%s" demo button', async (label, address) => {
    renderLogin()

    await userEvent.click(screen.getByRole('button', { name: label }))

    expect(email()).toHaveValue(address)
    expect(password()).toHaveValue(DEMO_PASSWORD)
  })

  it('has no accessibility violations', async () => {
    const { container } = renderLogin()

    expect(await axe(container)).toHaveNoViolations()
  })
})
