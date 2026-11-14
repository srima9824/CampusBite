import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import useOrderFilters from './useOrderFilters.js'

function setup(path) {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  return renderHook(() => ({ filters: useOrderFilters(), location: useLocation() }), { wrapper })
}

describe('useOrderFilters', () => {
  it('reads status, dates and page from the URL into the query', () => {
    const { result } = setup('/o?status=READY&date_from=2026-05-01&date_to=2026-05-09&page=3')

    expect(result.current.filters.query).toEqual({
      status: 'READY',
      date_from: '2026-05-01',
      date_to: '2026-05-09',
      page: 3,
    })
    expect(result.current.filters.isFiltered).toBe(true)
  })

  it('defaults to page 1, no filters and not filtered', () => {
    const { result } = setup('/o')

    expect(result.current.filters.page).toBe(1)
    expect(result.current.filters.isFiltered).toBe(false)
    expect(result.current.filters.query.status).toBe('')
  })

  it.each(['0', '-2', 'abc'])('treats page=%s as page 1', (page) => {
    const { result } = setup(`/o?page=${page}`)

    expect(result.current.filters.page).toBe(1)
  })

  it('ignores an unknown status', () => {
    const { result } = setup('/o?status=LOST')

    expect(result.current.filters.filters.status).toBe('')
  })

  it('flags an inverted range and leaves both dates out of the query', () => {
    const { result } = setup('/o?date_from=2026-05-10&date_to=2026-05-01')

    expect(result.current.filters.rangeInvalid).toBe(true)
    expect(result.current.filters.query.date_from).toBe('')
    expect(result.current.filters.query.date_to).toBe('')
  })

  it('writes new filters to the URL and drops the page', () => {
    const { result } = setup('/o?page=4')

    act(() => result.current.filters.applyFilters({ status: 'PLACED', date_from: '', date_to: '' }))

    expect(result.current.location.search).toBe('?status=PLACED')
  })

  it('keeps the filters when moving to another page', () => {
    const { result } = setup('/o?status=PLACED')

    act(() => result.current.filters.goToPage(2))

    expect(result.current.location.search).toBe('?status=PLACED&page=2')
  })

  it('goes back to the first page by replacing the entry, keeping filters', () => {
    const { result } = setup('/o?status=PLACED&page=9')

    act(() => result.current.filters.backToFirstPage())

    expect(result.current.location.search).toBe('?status=PLACED')
  })

  it('clears everything', () => {
    const { result } = setup('/o?status=PLACED&page=2')

    act(() => result.current.filters.clearFilters())

    expect(result.current.location.search).toBe('')
  })
})
