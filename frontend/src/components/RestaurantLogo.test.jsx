import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RestaurantLogo from './RestaurantLogo.jsx'

const restaurant = { id: 4, name: 'Pizza Pronto', logo_url: '/logos/pizza.svg' }
const image = (container) => container.querySelector('img')

describe('RestaurantLogo', () => {
  it('renders the logo image from logo_url as decorative', () => {
    const { container } = render(<RestaurantLogo restaurant={restaurant} />)

    expect(image(container)).toHaveAttribute('src', '/logos/pizza.svg')
    expect(image(container)).toHaveAttribute('alt', '')
    expect(screen.queryByText('P')).not.toBeInTheDocument()
  })

  it('falls back to the initial tile when the image fails to load', () => {
    const { container } = render(<RestaurantLogo restaurant={restaurant} />)

    fireEvent.error(image(container))

    expect(image(container)).toBeNull()
    expect(screen.getByText('P')).toBeInTheDocument()
  })

  it('shows the initial tile straight away when logo_url is missing', () => {
    const { container } = render(<RestaurantLogo restaurant={{ id: 9, name: 'Wrap Star' }} />)

    expect(image(container)).toBeNull()
    expect(screen.getByText('W')).toBeInTheDocument()
  })

  it('hides the tile from assistive technology because the name sits beside it', () => {
    const { container } = render(<RestaurantLogo restaurant={restaurant} size="md" />)

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the image again for another restaurant after one url broke', () => {
    const { container, rerender } = render(<RestaurantLogo restaurant={restaurant} />)
    fireEvent.error(image(container))

    rerender(<RestaurantLogo restaurant={{ id: 5, name: 'Taco Tuesday', logo_url: '/logos/taco.svg' }} />)

    expect(image(container)).toHaveAttribute('src', '/logos/taco.svg')
  })
})
