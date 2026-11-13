import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import Select from './Select.jsx'

const options = [
  { value: '', label: 'All statuses' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'DELIVERED', label: 'Delivered' },
]

describe('Select', () => {
  it('associates the label with the select', () => {
    render(<Select label="Status" options={options} />)

    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
  })

  it('renders every option with its label', () => {
    render(<Select label="Status" options={options} />)

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All statuses',
      'Placed',
      'Delivered',
    ])
  })

  it('reports the chosen value through onChange', async () => {
    const onChange = vi.fn()
    render(<Select label="Status" options={options} onChange={onChange} />)

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'DELIVERED')

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].target.value).toBe('DELIVERED')
  })

  it('shows the controlled value', () => {
    render(<Select label="Status" options={options} value="PLACED" onChange={() => {}} />)

    expect(screen.getByLabelText('Status')).toHaveValue('PLACED')
  })

  it('links the hint to the select', () => {
    render(<Select label="Status" options={options} hint="Pick one" />)

    expect(screen.getByLabelText('Status')).toHaveAccessibleDescription('Pick one')
  })

  it('links the error to the select and marks it invalid', () => {
    render(<Select label="Status" options={options} error="Choose a status" />)

    const select = screen.getByLabelText('Status')
    expect(select).toHaveAccessibleDescription('Choose a status')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('has no description and is not invalid without a hint or error', () => {
    render(<Select label="Status" options={options} />)

    const select = screen.getByLabelText('Status')
    expect(select).not.toHaveAttribute('aria-describedby')
    expect(select).not.toHaveAttribute('aria-invalid')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Select label="Status" options={options} hint="Pick one" error="Required" />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
