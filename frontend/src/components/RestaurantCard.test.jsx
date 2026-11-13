import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import RestaurantCard from './RestaurantCard.jsx'

const restaurant = {
  id: 4,
  name: 'Pizza Pronto',
  cuisine: 'Italian',
  description: 'Wood-fired slices.',
}

function renderCard() {
  return render(
    <MemoryRouter>
      <RestaurantCard restaurant={restaurant} />
    </MemoryRouter>,
  )
}

describe('RestaurantCard', () => {
  it('is a single link to the restaurant menu named by the restaurant', () => {
    renderCard()

    expect(screen.getByRole('link', { name: 'Pizza Pronto' })).toHaveAttribute('href', '/restaurants/4')
  })

  it('shows the cuisine and description', () => {
    renderCard()

    expect(screen.getByText('Italian')).toBeInTheDocument()
    expect(screen.getByText('Wood-fired slices.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderCard()

    expect(await axe(container)).toHaveNoViolations()
  })
})
