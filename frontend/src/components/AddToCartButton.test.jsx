import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useCart } from '../context/CartContext.jsx'
import { renderWithAuth } from '../test/helpers.jsx'
import AddToCartButton from './AddToCartButton.jsx'

const dosaDash = { id: 1, name: 'Dosa Dash' }
const burgerBarn = { id: 3, name: 'Burger Barn' }
const masala = { id: 1, name: 'Masala Dosa', price: 80 }
const burger = { id: 15, name: 'Classic Cheeseburger', price: 180 }

function CartSummary() {
  const { lines, restaurantName } = useCart()
  return (
    <p data-testid="cart">
      {restaurantName}: {lines.map((line) => `${line.quantity}x${line.name}`).join(',')}
    </p>
  )
}

function renderButtons() {
  return renderWithAuth(
    <>
      <AddToCartButton item={masala} restaurant={dosaDash} />
      <AddToCartButton item={burger} restaurant={burgerBarn} />
      <CartSummary />
    </>,
  )
}

const cartText = () => screen.getByTestId('cart').textContent

describe('AddToCartButton', () => {
  it('adds the item and confirms with a toast', async () => {
    renderButtons()

    await userEvent.click(screen.getByRole('button', { name: 'Add Masala Dosa to cart' }))

    expect(cartText()).toBe('Dosa Dash: 1xMasala Dosa')
    expect(screen.getByText('Added to your cart')).toBeInTheDocument()
  })

  it('turns into a quantity stepper once the item is in the cart', async () => {
    renderButtons()

    await userEvent.click(screen.getByRole('button', { name: 'Add Masala Dosa to cart' }))

    expect(screen.queryByRole('button', { name: 'Add Masala Dosa to cart' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Quantity of Masala Dosa' })).toHaveTextContent('1')
  })

  it('changes the cart quantity from the stepper', async () => {
    renderButtons()
    await userEvent.click(screen.getByRole('button', { name: 'Add Masala Dosa to cart' }))

    await userEvent.click(screen.getByRole('button', { name: 'Add one more Masala Dosa' }))

    expect(cartText()).toBe('Dosa Dash: 2xMasala Dosa')
  })

  describe('when the cart holds another restaurant', () => {
    async function startWithDosaInCart() {
      renderButtons()
      await userEvent.click(screen.getByRole('button', { name: 'Add Masala Dosa to cart' }))
      await userEvent.click(screen.getByRole('button', { name: 'Add Classic Cheeseburger to cart' }))
    }

    it('asks before starting a new cart and names the current restaurant', async () => {
      await startWithDosaInCart()

      expect(screen.getByRole('dialog', { name: 'Start a new cart?' })).toHaveTextContent(
        'Your cart has items from Dosa Dash. Starting a new one clears them.',
      )
    })

    it('keeps the old cart when the shopper cancels', async () => {
      await startWithDosaInCart()

      await userEvent.click(screen.getByRole('button', { name: 'Keep my cart' }))

      expect(cartText()).toBe('Dosa Dash: 1xMasala Dosa')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('replaces the cart when the shopper confirms', async () => {
      await startWithDosaInCart()

      await userEvent.click(screen.getByRole('button', { name: 'Start new cart' }))

      expect(cartText()).toBe('Burger Barn: 1xClassic Cheeseburger')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
