import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import * as restaurantsApi from '../api/restaurants.js'
import { resetStore, setLatency } from '../api/testing.js'
import { ToastProvider } from '../components/ui'
import { CartProvider, useCart } from '../context/CartContext.jsx'
import { FILTER_HINT } from '../components/FilterActions.jsx'
import RestaurantMenu from './RestaurantMenu.jsx'

function Url() {
  const { pathname, search } = useLocation()
  return <p data-testid="url">{pathname + search}</p>
}

function CartCount() {
  return <p data-testid="cart-count">{useCart().itemCount}</p>
}

function renderPage(entry = '/restaurants/1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <CartProvider>
          <Routes>
            <Route path="/restaurants/:restaurantId" element={<RestaurantMenu />} />
          </Routes>
          <CartCount />
        </CartProvider>
      </ToastProvider>
      <Url />
    </MemoryRouter>,
  )
}

const url = () => screen.getByTestId('url').textContent
const itemHeadings = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent)

beforeEach(() => {
  resetStore()
  setLatency(0)
  vi.restoreAllMocks()
})

describe('RestaurantMenu page', () => {
  it('shows a loading state, then the restaurant header and grouped items', async () => {
    renderPage()

    expect(screen.getByRole('status', { name: 'Loading the menu' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })).toBeInTheDocument()
    expect(screen.getByText('South Indian')).toBeInTheDocument()
    const categories = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(categories).toEqual(['Dosas', 'Breakfast', 'Drinks'])
    expect(screen.getByText('Rs. 80.00')).toBeInTheDocument()
  })

  it('links back to all kitchens', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(screen.getByRole('link', { name: 'Back to all kitchens' })).toHaveAttribute('href', '/restaurants')
  })

  it('flags unavailable items with a Sold out badge', async () => {
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(screen.getAllByText('Sold out').length).toBeGreaterThan(0)
  })

  it('narrows the menu by search text and writes it to the URL', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    await userEvent.type(screen.getByLabelText('Search the menu'), 'lassi')

    await waitFor(() => expect(itemHeadings()).toEqual(['Mango Lassi']))
    expect(url()).toBe('/restaurants/1?q=lassi')
  })

  it('narrows the menu by price range from the inputs', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    await userEvent.type(screen.getByLabelText('Min price (Rs.)'), '60')
    await userEvent.type(screen.getByLabelText('Max price (Rs.)'), '80')

    await waitFor(() => expect(itemHeadings()).toHaveLength(3))
    expect(itemHeadings()).toEqual(expect.arrayContaining(['Masala Dosa', 'Idli Sambar', 'Mango Lassi']))
    expect(url()).toBe('/restaurants/1?min_price=60&max_price=80')
  })

  it('applies search and max price from the URL to the inputs and the list', async () => {
    renderPage('/restaurants/1?q=dosa&max_price=100')

    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(itemHeadings()).toEqual(['Masala Dosa'])
    expect(screen.getByLabelText('Search the menu')).toHaveValue('dosa')
    expect(screen.getByLabelText('Max price (Rs.)')).toHaveValue(100)
  })

  it('shows an inline message for an inverted price range and keeps the list visible', async () => {
    renderPage('/restaurants/1?min_price=200&max_price=50')

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimum price is higher than the maximum/i)
    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })).toBeInTheDocument()
    expect(itemHeadings().length).toBeGreaterThan(0)
  })

  it('shows the empty state when nothing matches and Clear filters restores the menu', async () => {
    renderPage('/restaurants/1?q=zzz')

    const emptyTitle = await screen.findByRole('heading', { name: 'Nothing on the menu matches' })

    await userEvent.click(within(emptyTitle.parentElement).getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(itemHeadings().length).toBeGreaterThan(0))
    expect(screen.getByLabelText('Search the menu')).toHaveValue('')
    expect(url()).toBe('/restaurants/1')
  })

  it('shows a not-found state with a way back for an unknown restaurant', async () => {
    renderPage('/restaurants/999')

    expect(await screen.findByRole('heading', { level: 1, name: 'We could not find that kitchen' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to all kitchens' })).toHaveAttribute('href', '/restaurants')
  })

  it('shows the error with Retry and recovers on retry', async () => {
    vi.spyOn(restaurantsApi, 'listMenu').mockRejectedValueOnce(new Error('The menu went cold.'))
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The menu went cold.')

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })).toBeInTheDocument()
  })

  it('has no accessibility violations once loaded', async () => {
    const { container } = renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('adds a dish to the cart from its card and updates the cart count', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    await userEvent.click(screen.getByRole('button', { name: 'Add Masala Dosa to cart' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add one more Masala Dosa' }))

    expect(screen.getByTestId('cart-count')).toHaveTextContent('2')
  })

  it('gives a sold-out dish no add button', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cheese Dosa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Masala Dosa to cart' })).toBeInTheDocument()
  })
})

describe('RestaurantMenu filter form', () => {
  const form = () => screen.getByRole('search', { name: 'Filter the menu' })
  const ready = () => screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

  it('shows the hint and links it to the form', async () => {
    renderPage()
    await ready()

    expect(screen.getByText(FILTER_HINT)).toBeInTheDocument()
    expect(form()).toHaveAccessibleDescription(FILTER_HINT)
  })

  it('offers Apply before Clear filters in the form', async () => {
    renderPage()
    await ready()

    const buttons = within(form()).getAllByRole('button').map((button) => button.textContent)
    expect(buttons).toEqual(['Apply', 'Clear filters'])
  })

  it('applies all three fields at once when Apply is clicked', async () => {
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Search the menu'), { target: { value: 'dosa' } })
    fireEvent.change(screen.getByLabelText('Min price (Rs.)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Max price (Rs.)'), { target: { value: '100' } })

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(url()).toBe('/restaurants/1?q=dosa&min_price=50&max_price=100')
    await waitFor(() => expect(itemHeadings()).toEqual(['Masala Dosa']))
  })

  it('applies at once when Enter is pressed in a field', async () => {
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Search the menu'), { target: { value: 'lassi' } })

    await userEvent.type(screen.getByLabelText('Search the menu'), '{Enter}')

    expect(url()).toBe('/restaurants/1?q=lassi')
  })

  it('still alerts on an inverted range after Apply and does not send it to the api', async () => {
    const spy = vi.spyOn(restaurantsApi, 'listMenu')
    renderPage()
    await ready()
    fireEvent.change(screen.getByLabelText('Min price (Rs.)'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('Max price (Rs.)'), { target: { value: '50' } })

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimum price is higher than the maximum/i)
    expect(spy.mock.calls.some(([, filters]) => filters.min_price === '200' || filters.max_price === '50')).toBe(false)
    expect(itemHeadings().length).toBeGreaterThan(0)
  })

  it('clears the fields and the URL with the form Clear filters button', async () => {
    renderPage('/restaurants/1?q=lassi&min_price=10')
    await ready()

    await userEvent.click(within(form()).getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByLabelText('Search the menu')).toHaveValue('')
    expect(screen.getByLabelText('Min price (Rs.)')).toHaveValue(null)
    expect(url()).toBe('/restaurants/1')
  })

  it('still auto-applies the search after the debounce without pressing Apply', async () => {
    renderPage()
    await ready()

    await userEvent.type(screen.getByLabelText('Search the menu'), 'idli')

    await waitFor(() => expect(url()).toBe('/restaurants/1?q=idli'))
  })

  it('shows the restaurant logo in the header', async () => {
    const { container } = renderPage()
    await ready()

    expect(container.querySelector('header img')).toHaveAttribute('src')
  })
})
