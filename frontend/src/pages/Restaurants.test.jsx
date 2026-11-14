import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const searchBox = () => screen.getByRole('searchbox', { name: 'Search kitchens' })

beforeEach(() => {
  resetStore()
  setLatency(0)
  vi.restoreAllMocks()
})

describe('Restaurants page', () => {
  it('shows skeletons while loading, then the four restaurant cards', async () => {
    renderPage()

    expect(screen.getByRole('status', { name: 'Loading kitchens' })).toBeInTheDocument()
    expect(await cards()).toHaveLength(4)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Pick your kitchen' })).toBeInTheDocument()
  })

  it('lists exactly the four restaurants, in order, with no paginator', async () => {
    renderPage()

    const links = await cards()
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Dosa Dash'),
      expect.stringContaining('Burger Barn'),
      expect.stringContaining('Taco Tuesday'),
      expect.stringContaining('Chai & Chill'),
    ])
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('shows the empty state for page two because four restaurants fit on one page', async () => {
    renderPage('/restaurants?page=2')

    expect(await screen.findByRole('heading', { name: 'No kitchens match that' })).toBeInTheDocument()
  })

  it('filters by the search text and writes it to the URL', async () => {
    renderPage()
    await cards()

    await userEvent.type(searchBox(), 'dosa')

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(1))
    expect(screen.getByRole('link', { name: 'Dosa Dash' })).toBeInTheDocument()
    expect(url()).toBe('/restaurants?q=dosa')
  })

  it('reads the search from the URL into the box and the list', async () => {
    renderPage('/restaurants?q=burger')

    expect(await screen.findByRole('link', { name: 'Burger Barn' })).toBeInTheDocument()
    expect(searchBox()).toHaveValue('burger')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('shows the empty state when nothing matches and Clear search restores everyone', async () => {
    renderPage('/restaurants?q=xyz')

    expect(await screen.findByRole('heading', { name: 'No kitchens match that' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect(await cards()).toHaveLength(4)
    expect(searchBox()).toHaveValue('')
    expect(url()).toBe('/restaurants')
  })

  it('shows the empty state for a page past the last one', async () => {
    renderPage('/restaurants?page=9')

    expect(await screen.findByRole('heading', { name: 'No kitchens match that' })).toBeInTheDocument()
  })

  it('treats a non-numeric page as page one', async () => {
    renderPage('/restaurants?page=abc')

    expect(await cards()).toHaveLength(4)
  })

  it('shows the error with Retry and recovers on retry', async () => {
    const spy = vi
      .spyOn(restaurantsApi, 'listRestaurants')
      .mockRejectedValueOnce(new Error('The kitchens went dark.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The kitchens went dark.')

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await cards()).toHaveLength(4)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('has no accessibility violations once loaded', async () => {
    const { container } = renderPage()
    await cards()

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Restaurants search form', () => {
  const form = () => screen.getByRole('search', { name: 'Search kitchens' })

  it('shows no hint and no Apply button, only Clear filters', async () => {
    renderPage()
    await cards()

    expect(screen.queryByText(/press Apply/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    const buttons = within(form()).getAllByRole('button').map((button) => button.textContent)
    expect(buttons).toEqual(['Clear filters'])
  })

  it('uses a generic lead line without any numbers', async () => {
    renderPage()
    await cards()

    const lead = screen.getByText('Pick a kitchen and have your food at your table in minutes.')
    expect(lead.textContent).not.toMatch(/\d/)
    expect(lead.textContent).not.toMatch(/\b(one|two|three|four|five)\b/i)
    expect(screen.queryByText(/Four campus favourites/)).not.toBeInTheDocument()
  })

  it('applies at once when Enter is pressed in the box', async () => {
    renderPage()
    await cards()
    fireEvent.change(searchBox(), { target: { value: 'burger' } })

    await userEvent.type(searchBox(), '{Enter}')

    expect(url()).toBe('/restaurants?q=burger')
  })

  it('drops the page parameter when a new search is typed', async () => {
    renderPage('/restaurants?q=a&page=2')
    await screen.findByRole('heading', { name: 'No kitchens match that' })

    await userEvent.clear(searchBox())
    await userEvent.type(searchBox(), 'taco')

    await waitFor(() => expect(url()).toBe('/restaurants?q=taco'))
  })

  it('leaves the URL without q when the box is emptied', async () => {
    renderPage('/restaurants?q=burger')
    await cards()

    await userEvent.clear(searchBox())

    await waitFor(() => expect(url()).toBe('/restaurants'))
  })

  it('clears the box and the URL with Clear filters', async () => {
    renderPage('/restaurants?q=burger&page=1')
    await screen.findByRole('link', { name: 'Burger Barn' })

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(searchBox()).toHaveValue('')
    expect(url()).toBe('/restaurants')
    expect(await cards()).toHaveLength(4)
  })

  it('still auto-applies the text as you type, after the debounce', async () => {
    renderPage()
    await cards()

    await userEvent.type(searchBox(), 'chai')

    await waitFor(() => expect(url()).toBe('/restaurants?q=chai'))
  })

  it('shows restaurant logos on the cards', async () => {
    const { container } = renderPage()
    await cards()

    const logos = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(logos).toHaveLength(4)
    expect(logos.every(Boolean)).toBe(true)
  })
})
