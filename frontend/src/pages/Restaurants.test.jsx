import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { resetStore, setLatency } from '../api/testing.js'
import * as restaurantsApi from '../api/restaurants.js'
import Restaurants from './Restaurants.jsx'

function Url() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function renderPage(entry = '/restaurants') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/restaurants" element={<Restaurants />} />
      </Routes>
      <Url />
    </MemoryRouter>,
  )
}

const cards = () => screen.findAllByRole('link')
const url = () => screen.getByTestId('url').textContent

beforeEach(() => {
  resetStore()
  setLatency(0)
  vi.restoreAllMocks()
})

describe('Restaurants page', () => {
  it('shows skeletons while loading, then six restaurant cards', async () => {
    renderPage()

    expect(screen.getByRole('status', { name: 'Loading kitchens' })).toBeInTheDocument()
    expect(await cards()).toHaveLength(6)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Pick your kitchen' })).toBeInTheDocument()
  })

  it('shows the last two restaurants on page two taken from the URL', async () => {
    renderPage('/restaurants?page=2')

    expect(await cards()).toHaveLength(2)
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('moves to the next page and puts it in the URL', async () => {
    renderPage()
    await cards()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2))
    expect(url()).toBe('/restaurants?page=2')
  })

  it('keeps the search text when paging', async () => {
    renderPage('/restaurants?q=a')
    await cards()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(url()).toBe('/restaurants?q=a&page=2')
  })

  it('filters by the search text and writes it to the URL', async () => {
    renderPage()
    await cards()

    await userEvent.type(screen.getByLabelText('Search kitchens'), 'dosa')

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1))
    expect(screen.getByRole('link', { name: 'Dosa Dash' })).toBeInTheDocument()
    expect(url()).toBe('/restaurants?q=dosa')
  })

  it('reads the search from the URL into the box and the list', async () => {
    renderPage('/restaurants?q=pizza')

    expect(await screen.findByRole('link', { name: 'Pizza Pronto' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search kitchens')).toHaveValue('pizza')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('shows the empty state when nothing matches and Clear search restores everyone', async () => {
    renderPage('/restaurants?q=xyz')

    expect(await screen.findByRole('heading', { name: 'No kitchens match that' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(await cards()).toHaveLength(6)
    expect(screen.getByLabelText('Search kitchens')).toHaveValue('')
    expect(url()).toBe('/restaurants')
  })

  it('shows the empty state for a page past the last one', async () => {
    renderPage('/restaurants?page=9')

    expect(await screen.findByRole('heading', { name: 'No kitchens match that' })).toBeInTheDocument()
  })

  it('treats a non-numeric page as page one', async () => {
    renderPage('/restaurants?page=abc')

    expect(await cards()).toHaveLength(6)
  })

  it('shows the error with Retry and recovers on retry', async () => {
    const spy = vi
      .spyOn(restaurantsApi, 'listRestaurants')
      .mockRejectedValueOnce(new Error('The kitchens went dark.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The kitchens went dark.')

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await cards()).toHaveLength(6)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('has no accessibility violations once loaded', async () => {
    const { container } = renderPage()
    await cards()

    expect(await axe(container)).toHaveNoViolations()
  })
})
