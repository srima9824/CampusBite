import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import App from '../App.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  it('shows the home heading at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: /kitchen is still warming up/i })).toBeInTheDocument()
  })

  it('shows the not-found state for an unknown path', () => {
    renderAt('/no-such-dish')
    expect(screen.getByRole('heading', { level: 1, name: /left the table/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to the kitchen/i })).toHaveAttribute('href', '/')
  })

  it('wraps pages in the shell with a skip link and navigation', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })
})

describe('styleguide', () => {
  it('shows the heading and a section per token group', () => {
    renderAt('/styleguide')
    expect(screen.getByRole('heading', { level: 1, name: 'Styleguide' })).toBeInTheDocument()
    for (const name of ['Colors', 'Typography', 'Spacing', 'Radius and shadow']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('shows each base component', () => {
    renderAt('/styleguide')
    for (const name of ['Button', 'Input', 'Badge', 'Skeleton', 'Empty state']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Find a snack' })).toBeInTheDocument()
    expect(screen.getByLabelText('Campus email')).toBeInTheDocument()
    expect(screen.getByText('success')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderAt('/styleguide')
    expect(await axe(container)).toHaveNoViolations()
  })
})
