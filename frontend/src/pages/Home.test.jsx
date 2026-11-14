import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { resetStore, setLatency } from '../api/testing.js'
import Home from './Home.jsx'

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetStore()
  setLatency(0)
})

describe('Home page', () => {
  it('shows the hero heading and lead', () => {
    renderHome()

    expect(screen.getByRole('heading', { level: 1, name: 'Hungry? Pick a kitchen.' })).toBeInTheDocument()
    expect(screen.getByText('Eight campus favourites, one tap away.')).toBeInTheDocument()
  })

  it('links to all kitchens', () => {
    renderHome()

    expect(screen.getByRole('link', { name: 'Browse all kitchens' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows the featured kitchens carousel under the hero', async () => {
    renderHome()

    expect(await screen.findByRole('region', { name: 'Featured kitchens' })).toBeInTheDocument()
  })

  it('does not link to the styleguide', async () => {
    renderHome()
    await screen.findByRole('region', { name: 'Featured kitchens' })

    expect(screen.queryByRole('link', { name: /styleguide/i })).not.toBeInTheDocument()
  })

  it('has no accessibility violations once loaded', async () => {
    const { container } = renderHome()
    await screen.findByRole('region', { name: 'Featured kitchens' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
