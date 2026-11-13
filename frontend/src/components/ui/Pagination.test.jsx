import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import Pagination from './Pagination.jsx'

describe('Pagination', () => {
  it.each([
    [0, 'no results'],
    [6, 'exactly one page'],
  ])('renders nothing for %s total (%s)', (total) => {
    const { container } = render(<Pagination page={1} pageSize={6} total={total} onChange={() => {}} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the current page out of the page count', () => {
    render(<Pagination page={2} pageSize={6} total={13} onChange={() => {}} />)

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toHaveAttribute('aria-current', 'page')
  })

  it('disables Previous on the first page', () => {
    render(<Pagination page={1} pageSize={6} total={8} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('disables Next on the last page', () => {
    render(<Pagination page={2} pageSize={6} total={8} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('reports the next page number when Next is clicked', async () => {
    const onChange = vi.fn()
    render(<Pagination page={1} pageSize={6} total={8} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('reports the previous page number when Previous is clicked', async () => {
    const onChange = vi.fn()
    render(<Pagination page={3} pageSize={6} total={18} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(onChange).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Pagination page={2} pageSize={6} total={18} onChange={() => {}} />)

    expect(await axe(container)).toHaveNoViolations()
  })
})
