import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import DietChips from './DietChips.jsx'

describe('DietChips', () => {
  it('is a radiogroup named Diet with All, Veg and Non-veg', () => {
    render(<DietChips value="" onChange={() => {}} />)

    const group = screen.getByRole('radiogroup', { name: 'Diet' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['All', 'Veg', 'Non-veg'])
  })

  it('marks only the current choice as checked', () => {
    render(<DietChips value="veg" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: 'Veg' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Non-veg' })).not.toBeChecked()
  })

  it('reports the api value of the clicked chip', async () => {
    const onChange = vi.fn()
    render(<DietChips value="" onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Non-veg' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Veg' }))
    await userEvent.click(screen.getByRole('radio', { name: 'All' }))

    expect(onChange.mock.calls.map(([value]) => value)).toEqual(['non_veg', 'veg', ''])
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DietChips value="" onChange={() => {}} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
