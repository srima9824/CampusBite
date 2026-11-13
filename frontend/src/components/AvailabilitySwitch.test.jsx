import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import AvailabilitySwitch from './AvailabilitySwitch.jsx'

describe('AvailabilitySwitch', () => {
  it('is a checkbox named for the dish, checked when available', () => {
    render(<AvailabilitySwitch itemName="Masala Dosa" checked onChange={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: /^Available ?for Masala Dosa$/ })).toBeChecked()
  })

  it('is unchecked when the dish is sold out', () => {
    render(<AvailabilitySwitch itemName="Cheese Dosa" checked={false} onChange={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: /^Available ?for Cheese Dosa$/ })).not.toBeChecked()
  })

  it('reports the new value when toggled', async () => {
    const onChange = vi.fn()
    render(<AvailabilitySwitch itemName="Masala Dosa" checked onChange={onChange} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <AvailabilitySwitch itemName="Masala Dosa" checked onChange={vi.fn()} />
      </main>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
