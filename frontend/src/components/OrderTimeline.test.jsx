import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import OrderTimeline from './OrderTimeline.jsx'

const FORWARD = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']
const LABELS = ['Placed', 'Accepted', 'Preparing', 'Ready', 'Out for delivery', 'Delivered']

function historyThrough(status) {
  const steps = status === 'CANCELLED' ? ['PLACED', 'CANCELLED'] : FORWARD.slice(0, FORWARD.indexOf(status) + 1)
  return steps.map((step, index) => ({ status: step, changed_at: `2026-05-01T10:${String(index * 5).padStart(2, '0')}:00.000Z` }))
}

const stepTexts = () => screen.getAllByRole('listitem').map((item) => item.textContent)

describe('OrderTimeline', () => {
  it.each(FORWARD.map((status, index) => [status, index]))(
    'marks earlier steps Done, %s as Now and later steps Up next',
    (status, index) => {
      render(<OrderTimeline status={status} history={historyThrough(status)} />)

      const items = screen.getAllByRole('listitem')
      expect(items).toHaveLength(6)
      items.forEach((item, position) => {
        const expected = position < index ? 'Done' : position === index ? 'Now' : 'Up next'
        expect(item).toHaveTextContent(LABELS[position])
        expect(item).toHaveTextContent(expected)
      })
    },
  )

  it.each(FORWARD)('marks exactly one step with aria-current for %s', (status) => {
    render(<OrderTimeline status={status} history={historyThrough(status)} />)

    const current = screen.getAllByRole('listitem').filter((item) => item.getAttribute('aria-current') === 'step')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Now')
  })

  it('shows a time only for steps that were reached', () => {
    render(<OrderTimeline status="PREPARING" history={historyThrough('PREPARING')} />)

    const items = screen.getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('time') !== null)).toEqual([true, true, true, false, false, false])
    expect(within(items[0]).getByText(/2026/)).toHaveAttribute('datetime', '2026-05-01T10:00:00.000Z')
  })

  it('keeps the reached steps and ends on Cancelled for a cancelled order', () => {
    render(<OrderTimeline status="CANCELLED" history={historyThrough('CANCELLED')} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Placed')
    expect(items[0]).toHaveTextContent('Done')
    expect(items[1]).toHaveTextContent('Cancelled')
    expect(items[1]).toHaveTextContent('Now')
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(stepTexts().join(' ')).not.toMatch(/Up next/)
  })

  it('names the list as order progress', () => {
    render(<OrderTimeline status="PLACED" history={historyThrough('PLACED')} />)

    expect(screen.getByRole('list', { name: 'Order progress' })).toBeInTheDocument()
  })

  it.each([...FORWARD, 'CANCELLED'])('has no accessibility violations for %s', async (status) => {
    const { container } = render(<OrderTimeline status={status} history={historyThrough(status)} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
