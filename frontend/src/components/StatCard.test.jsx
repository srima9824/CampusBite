import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import StatCard from './StatCard.jsx'

describe('StatCard', () => {
  it('pairs the label with its value as a term and description', () => {
    render(
      <dl>
        <StatCard label="Total orders" value={6} />
      </dl>,
    )

    expect(screen.getByRole('term')).toHaveTextContent('Total orders')
    expect(screen.getAllByRole('definition')[0]).toHaveTextContent('6')
  })

  it('shows the hint only when one is given', () => {
    render(
      <dl>
        <StatCard label="Revenue" value="Rs. 10.00" hint="Cancelled orders not counted" />
        <StatCard label="Orders today" value={2} />
      </dl>,
    )

    expect(screen.getByText('Cancelled orders not counted')).toBeInTheDocument()
    expect(screen.getAllByRole('definition')).toHaveLength(3)
  })

  it('has no accessibility violations inside a list', async () => {
    const { container } = render(
      <main>
        <dl>
          <StatCard label="Total orders" value={6} hint="All time" />
        </dl>
      </main>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
