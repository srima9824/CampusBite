import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import MenuItemCard from './MenuItemCard.jsx'

const item = {
  id: 1,
  name: 'Masala Dosa',
  description: 'Crisp rice crepe.',
  category: 'Dosas',
  price: 80,
  is_veg: true,
  is_available: true,
}

describe('MenuItemCard', () => {
  it('shows name, description, category and formatted price', () => {
    render(<MenuItemCard item={item} />)

    expect(screen.getByRole('heading', { level: 3, name: /Masala Dosa/ })).toBeInTheDocument()
    expect(screen.getByText('Crisp rice crepe.')).toBeInTheDocument()
    expect(screen.getByText('Dosas')).toBeInTheDocument()
    expect(screen.getByText('Rs. 80.00')).toBeInTheDocument()
  })

  it('marks a vegetarian dish with an accessible label', () => {
    render(<MenuItemCard item={item} />)

    expect(screen.getByRole('img', { name: 'Vegetarian' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Non-vegetarian' })).not.toBeInTheDocument()
  })

  it('marks a non-vegetarian dish with an accessible label', () => {
    render(<MenuItemCard item={{ ...item, is_veg: false }} />)

    expect(screen.getByRole('img', { name: 'Non-vegetarian' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Vegetarian' })).not.toBeInTheDocument()
  })

  it('does not show the sold out badge for an available item', () => {
    render(<MenuItemCard item={item} />)

    expect(screen.queryByText('Sold out')).not.toBeInTheDocument()
  })

  it('shows a Sold out text badge for an unavailable item', () => {
    render(<MenuItemCard item={{ ...item, is_available: false }} />)

    expect(screen.getByText('Sold out')).toBeVisible()
  })

  it('renders the action slot', () => {
    render(<MenuItemCard item={item} action={<button type="button">Add</button>} />)

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('has no accessibility violations when sold out', async () => {
    const { container } = render(
      <main>
        <h2>Dosas</h2>
        <MenuItemCard item={{ ...item, is_available: false }} />
      </main>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
