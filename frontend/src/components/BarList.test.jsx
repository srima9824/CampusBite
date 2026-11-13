import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import BarList from './BarList.jsx'

const rows = [
  { key: 'a', label: 'Masala Dosa', value: 4 },
  { key: 'b', label: 'Filter Coffee', value: 2 },
  { key: 'c', label: 'Mango Lassi', value: 0 },
]

const barWidths = (container) => [...container.querySelectorAll('[aria-hidden="true"] > span')].map((bar) => bar.style.width)

describe('BarList', () => {
  it('is a labelled list with each name and number as text', () => {
    render(<BarList label="Top sellers by quantity" rows={rows} />)

    const items = within(screen.getByRole('list', { name: 'Top sellers by quantity' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Masala Dosa4', 'Filter Coffee2', 'Mango Lassi0'])
  })

  it('scales bars so the largest fills the track and zero is empty', () => {
    const { container } = render(<BarList label="Sales" rows={rows} />)

    expect(barWidths(container)).toEqual(['100%', '50%', '0%'])
  })

  it('keeps every bar empty when all values are zero', () => {
    const { container } = render(<BarList label="Sales" rows={rows.map((row) => ({ ...row, value: 0 }))} />)

    expect(barWidths(container)).toEqual(['0%', '0%', '0%'])
  })

  it('hides the bars from assistive technology', () => {
    const { container } = render(<BarList label="Sales" rows={rows} />)

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(rows.length)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <BarList label="Sales" rows={rows} />
      </main>,
    )

    expect(await axe(container)).toHaveNoViolations()
  })
})
