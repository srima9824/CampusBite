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
  it('shows the hero heading and intro', () => {
    renderHome()

    expect(screen.getByRole('heading', { level: 1, name: 'Hungry? Pick a kitchen.' })).toBeInTheDocument()
    expect(screen.getByText(/CampusBite brings your campus kitchens to/)).toBeInTheDocument()
  })

  it('highlights "one tap" in the intro, above the slider', () => {
    renderHome()

    const intro = screen.getByText(/CampusBite brings your campus kitchens to/)
    expect(intro).toHaveTextContent(
      'CampusBite brings your campus kitchens to one tap. Browse menus, order in a minute and track your food from the pan to your door.',
    )
    expect(screen.getByText('one tap')).toHaveClass(/highlight/)
    expect(screen.getByText('one tap').parentElement).toBe(intro)
    expect(screen.getByRole('heading', { level: 1 }).compareDocumentPosition(intro)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('links to all kitchens', () => {
    renderHome()

    expect(screen.getByRole('link', { name: 'Browse all kitchens' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows the featured kitchens carousel under the hero', async () => {
    renderHome()

    expect(await screen.findByRole('region', { name: 'Featured kitchens' })).toBeInTheDocument()
  })

  it('offers Previous and Next on the slider but no Pause or Play button', async () => {
    renderHome()
    await screen.findByRole('region', { name: 'Featured kitchens' })

    expect(screen.getByRole('button', { name: 'Previous kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next kitchen' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pause|play/i })).not.toBeInTheDocument()
  })

  it('has no accessibility violations once loaded', async () => {
    const { container } = renderHome()
    await screen.findByRole('region', { name: 'Featured kitchens' })

    expect(await axe(container)).toHaveNoViolations()
  })
})
