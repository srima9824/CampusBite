import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import QuantityStepper from './QuantityStepper.jsx'

function renderStepper(quantity, onChange = vi.fn()) {
  const view = render(<QuantityStepper name="Masala Dosa" quantity={quantity} onChange={onChange} />)
  return { ...view, onChange }
}

describe('QuantityStepper', () => {
  it('shows the quantity in a group named after the item', () => {
    renderStepper(3)

    expect(screen.getByRole('group', { name: 'Quantity of Masala Dosa' })).toHaveTextContent('3')
  })

  it('asks for one more when plus is pressed', async () => {
    const { onChange } = renderStepper(3)

    await userEvent.click(screen.getByRole('button', { name: 'Add one more Masala Dosa' }))

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('asks for one fewer when minus is pressed', async () => {
    const { onChange } = renderStepper(3)

    await userEvent.click(screen.getByRole('button', { name: 'Remove one Masala Dosa' }))

    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('disables minus at 1 so it cannot drop below one', () => {
    renderStepper(1)

    expect(screen.getByRole('button', { name: 'Remove one Masala Dosa' })).toBeDisabled()
  })

  it('disables plus at 20 so it cannot exceed the limit', () => {
    renderStepper(20)

    expect(screen.getByRole('button', { name: 'Add one more Masala Dosa' })).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderStepper(2)

    expect(await axe(container)).toHaveNoViolations()
  })
})
