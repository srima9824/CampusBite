import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App.jsx'
import { getSession } from '../api/session.js'
import { renderWithAuth, resetAuthWorld } from '../test/helpers.jsx'

const field = (name) => screen.getByLabelText(name)
const submit = () => screen.getByRole('button', { name: 'Sign up' })
const renderRegister = () => renderWithAuth(<App />, { entries: ['/register'] })

async function fill({ name = 'Nia Ortiz', email = 'nia@campusbite.test', password = 'long-enough-1', confirm = password }) {
  if (name) await userEvent.type(field('Name'), name)
  if (email) await userEvent.type(field('Email'), email)
  if (password) await userEvent.type(field('Password'), password)
  if (confirm) await userEvent.type(field('Confirm password'), confirm)
}

beforeEach(resetAuthWorld)

describe('Register page', () => {
  it('labels every field, shows the password hint and links to login', () => {
    renderRegister()

    for (const label of ['Name', 'Email', 'Password', 'Confirm password']) {
      expect(field(label)).toBeInTheDocument()
    }
    expect(field('Password')).toHaveAccessibleDescription(/at least 8 characters/i)
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('has no role field', () => {
    renderRegister()

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })

  it('shows an error on every field and focuses the first when submitted empty', async () => {
    renderRegister()

    await userEvent.click(submit())

    expect(field('Name')).toHaveAccessibleDescription(/your name/i)
    expect(field('Email')).toHaveAccessibleDescription(/enter your email/i)
    expect(field('Password')).toHaveAccessibleDescription(/at least 8 characters/i)
    expect(field('Name')).toHaveFocus()
  })

  it('rejects a malformed email', async () => {
    renderRegister()
    await fill({ email: 'not-an-email' })

    await userEvent.click(submit())

    expect(field('Email')).toHaveAccessibleDescription(/looks off/i)
    expect(field('Email')).toHaveFocus()
  })

  it('rejects a password shorter than 8 characters', async () => {
    renderRegister()
    await fill({ password: 'short' })

    await userEvent.click(submit())

    expect(field('Password')).toHaveAttribute('aria-invalid', 'true')
    expect(field('Password')).toHaveFocus()
  })

  it('rejects mismatched passwords on the confirm field', async () => {
    renderRegister()
    await fill({ password: 'long-enough-1', confirm: 'long-enough-2' })

    await userEvent.click(submit())

    expect(field('Confirm password')).toHaveAccessibleDescription(/do not match/i)
    expect(field('Confirm password')).toHaveFocus()
  })

  it('shows the taken-email error on the email field and focuses it', async () => {
    renderRegister()
    await fill({ email: 'maya@campusbite.test' })

    await userEvent.click(submit())

    await waitFor(() => expect(field('Email')).toHaveAccessibleDescription(/already taken/i))
    expect(field('Email')).toHaveFocus()
    expect(getSession()).toBeNull()
  })

  it('treats a differently cased existing email as taken', async () => {
    renderRegister()
    await fill({ email: 'MAYA@Campusbite.test' })

    await userEvent.click(submit())

    await waitFor(() => expect(field('Email')).toHaveAccessibleDescription(/already taken/i))
  })

  it('signs the new customer in and sends them home', async () => {
    renderRegister()
    await fill({})

    await userEvent.click(submit())

    expect(await screen.findByRole('heading', { level: 1, name: /pick your kitchen/i })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(await within(nav).findByText('Nia Ortiz')).toBeInTheDocument()
    expect(getSession().user.role).toBe('CUSTOMER')
  })

  it('lets the new account log out and log in again', async () => {
    renderRegister()
    await fill({})
    await userEvent.click(submit())
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    await userEvent.click(await within(nav).findByRole('button', { name: 'Log out' }))
    await userEvent.click(within(nav).getByRole('link', { name: 'Log in' }))

    await userEvent.type(field('Email'), 'nia@campusbite.test')
    await userEvent.type(field('Password'), 'long-enough-1')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await within(nav).findByText('Nia Ortiz')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderRegister()

    expect(await axe(container)).toHaveNoViolations()
  })
})
