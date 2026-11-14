import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import RestaurantCard from './RestaurantCard.jsx'

const restaurant = {
  id: 3,
  name: 'Burger Barn',
  cuisine: 'American',
  description: 'Stacked burgers.',
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

    expect(screen.getByRole('link', { name: 'Burger Barn' })).toHaveAttribute('href', '/restaurants/3')
  })

  it('shows the cuisine and description', () => {
    renderCard()

    expect(screen.getByText('American')).toBeInTheDocument()
    expect(screen.getByText('Stacked burgers.')).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderCard()

    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows the logo image when the restaurant has a logo_url', () => {
    const { container } = render(
      <MemoryRouter>
        <RestaurantCard restaurant={{ ...restaurant, logo_url: '/logos/burger.svg' }} />
      </MemoryRouter>,
    )

    expect(container.querySelector('img')).toHaveAttribute('src', '/logos/burger.svg')
  })

  it('shows the initial tile when the restaurant has no logo_url', () => {
    const { container } = renderCard()

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
