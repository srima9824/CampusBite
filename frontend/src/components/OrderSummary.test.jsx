import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import OrderSummary from './OrderSummary.jsx'

const lines = [
  { menu_item_id: 1, name: 'Masala Dosa', quantity: 2, line_total: 160 },
  { menu_item_id: 6, name: 'Filter Coffee', quantity: 1, line_total: 40.5 },
]

function renderSummary() {
  return render(<OrderSummary lines={lines} subtotal={200.5} deliveryFee={20} total={220.5} />)
}

describe('OrderSummary', () => {
  it('lists each line with quantity, name and formatted line total', () => {
    renderSummary()

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('2 x Masala Dosa')
    expect(items[0]).toHaveTextContent('Rs. 160.00')
    expect(items[1]).toHaveTextContent('1 x Filter Coffee')
    expect(items[1]).toHaveTextContent('Rs. 40.50')
  })

  it.each([
    ['Subtotal', 'Rs. 200.50'],
    ['Delivery fee', 'Rs. 20.00'],
    ['Total', 'Rs. 220.50'],
  ])('shows %s as %s', (label, amount) => {
    const { container } = renderSummary()

    const term = within(container).getByText(label, { selector: 'dt' })
    expect(term.nextElementSibling).toHaveTextContent(amount)
  })

  it('has no accessibility violations', async () => {
    const { container } = renderSummary()

    expect(await axe(container)).toHaveNoViolations()
  })
})
