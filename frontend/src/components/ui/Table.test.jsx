import { render, screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import Table from './Table.jsx'

const columns = [
  { key: 'name', header: 'Dish', render: (row) => row.name },
  { key: 'price', header: 'Price', render: (row) => `Rs. ${row.price}` },
]
const rows = [
  { id: 'a', name: 'Masala Dosa', price: 80 },
  { id: 'b', name: 'Filter Coffee', price: 40 },
]

const renderTable = (props = {}) =>
  render(<Table caption="Menu" columns={columns} rows={rows} getRowKey={(row) => row.id} {...props} />)

describe('Table', () => {
  it('names the table with its caption', () => {
    renderTable()

    expect(screen.getByRole('table', { name: 'Menu' })).toBeInTheDocument()
  })

  it('renders a column header for each column', () => {
    renderTable()

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Dish', 'Price'])
  })

  it('renders each cell through its column render function', () => {
    renderTable()

    const body = screen.getAllByRole('row').slice(1)
    expect(within(body[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Masala Dosa', 'Rs. 80'])
    expect(within(body[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Filter Coffee', 'Rs. 40'])
  })

  it('labels every cell with its column header so rows can stack as cards', () => {
    renderTable()

    const cells = screen.getAllByRole('cell')
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual(['Dish', 'Price', 'Dish', 'Price'])
  })

  it('shows only the header row when there are no rows', () => {
    renderTable({ rows: [] })

    expect(screen.getAllByRole('row')).toHaveLength(1)
    expect(screen.queryAllByRole('cell')).toHaveLength(0)
  })

  it('wraps the table in a labelled, keyboard focusable scroll region', () => {
    renderTable()

    const region = screen.getByRole('region', { name: 'Menu' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByRole('table')).toBeInTheDocument()
  })

  it('hides the caption visually but keeps it for assistive tech when asked', () => {
    renderTable({ hideCaption: true })

    expect(screen.getByText('Menu', { selector: 'caption' })).toHaveClass('visually-hidden')
    expect(screen.getByRole('table', { name: 'Menu' })).toBeInTheDocument()
  })

  it('keeps the caption visible by default', () => {
    renderTable()

    expect(screen.getByText('Menu', { selector: 'caption' })).not.toHaveClass('visually-hidden')
  })

  it('has no accessibility violations', async () => {
    const { container } = renderTable()

    expect(await axe(container)).toHaveNoViolations()
  })
})
