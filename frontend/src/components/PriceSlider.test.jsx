import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import PriceSlider from './PriceSlider.jsx'

describe('PriceSlider', () => {
  it('shows a live label with the rupee value and labels the slider with it', () => {
    render(<PriceSlider label="Min price" value={40} max={180} onChange={() => {}} />)

    expect(screen.getByText('Min price ₹40')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Min price ₹40' })).toHaveValue('40')
  })

  it('ranges from 0 to the given maximum', () => {
    render(<PriceSlider label="Max price" value={180} max={180} onChange={() => {}} />)

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '180')
  })

  it('reports the new value as a number', () => {
    const onChange = vi.fn()
    render(<PriceSlider label="Max price" value={180} max={180} onChange={onChange} />)

    fireEvent.change(screen.getByRole('slider'), { target: { value: '90' } })

    expect(onChange).toHaveBeenCalledWith(90)
  })

  it('is disabled while there is no menu to size the range from', () => {
    render(<PriceSlider label="Min price" value={0} max={0} onChange={() => {}} />)

    expect(screen.getByRole('slider')).toBeDisabled()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<PriceSlider label="Min price" value={40} max={180} onChange={() => {}} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
