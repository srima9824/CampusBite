import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import OrderFilters from './OrderFilters.jsx'

const empty = { status: '', date_from: '', date_to: '' }

function renderFilters({ values = empty, ...props } = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(<OrderFilters values={values} onChange={onChange} onClear={onClear} {...props} />)
  return { onChange, onClear }
}

describe('OrderFilters', () => {
  it('offers All statuses plus the seven order statuses', () => {
    renderFilters()

    const labels = screen.getAllByRole('option').map((option) => option.textContent)
    expect(labels).toEqual([
      'All statuses',
      'Placed',
      'Accepted',
      'Preparing',
      'Ready',
      'Out for delivery',
      'Delivered',
      'Cancelled',
    ])
  })

  it('emits the new status while keeping the other values', async () => {
    const { onChange } = renderFilters({ values: { ...empty, date_from: '2026-05-01' } })

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CANCELLED')

    expect(onChange).toHaveBeenCalledWith({ status: 'CANCELLED', date_from: '2026-05-01', date_to: '' })
  })

  it('emits the From date', () => {
    const { onChange } = renderFilters()

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-02' } })

    expect(onChange).toHaveBeenCalledWith({ status: '', date_from: '2026-05-02', date_to: '' })
  })

  it('emits the To date', () => {
    const { onChange } = renderFilters()

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-09' } })

    expect(onChange).toHaveBeenCalledWith({ status: '', date_from: '', date_to: '2026-05-09' })
  })

  it('shows the current values', () => {
    renderFilters({ values: { status: 'READY', date_from: '2026-05-01', date_to: '2026-05-09' } })

    expect(screen.getByLabelText('Status')).toHaveValue('READY')
    expect(screen.getByLabelText('From')).toHaveValue('2026-05-01')
    expect(screen.getByLabelText('To')).toHaveValue('2026-05-09')
  })

  it('calls onClear from Clear filters', async () => {
    const { onClear } = renderFilters({ values: { ...empty, status: 'READY' } })

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onClear).toHaveBeenCalledOnce()
  })

  it('limits each date by the other so the browser picker avoids an inverted range', () => {
    renderFilters({ values: { ...empty, date_from: '2026-05-01', date_to: '2026-05-09' } })

    expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-05-09')
    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-05-01')
  })

  it('shows the range error against the To field', () => {
    renderFilters({ rangeError: 'The start date must not be after the end date.' })

    expect(screen.getByLabelText('To')).toHaveAccessibleDescription('The start date must not be after the end date.')
  })

  it('shows no range error by default', () => {
    renderFilters()

    expect(screen.getByLabelText('To')).not.toHaveAttribute('aria-invalid')
  })

  it('drops the status select but keeps the date range when hideStatus is set', () => {
    renderFilters({ hideStatus: true })

    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
  })

  it('offers only the statusOptions it is given', async () => {
    const statusOptions = [
      { value: '', label: 'All active' },
      { value: 'READY', label: 'Ready for pickup' },
    ]
    const { onChange } = renderFilters({ statusOptions })

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['All active', 'Ready for pickup'])
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'READY')
    expect(onChange).toHaveBeenCalledWith({ ...empty, status: 'READY' })
  })

  it('has no accessibility violations without the status select', async () => {
    const { container } = render(<OrderFilters hideStatus values={empty} onChange={() => {}} onClear={() => {}} />)

    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <OrderFilters values={empty} onChange={() => {}} onClear={() => {}} rangeError="Bad range" />,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
