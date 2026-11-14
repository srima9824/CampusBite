import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import * as restaurantsApi from '../api/restaurants.js'
import { resetStore, setLatency } from '../api/testing.js'
import { ToastProvider } from '../components/ui'
import { CartProvider, useCart } from '../context/CartContext.jsx'
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
const itemHeadings = () => screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent.replace(/^(Non-vegetarian|Vegetarian)/, ''))
const minSlider = () => screen.getByRole('slider', { name: /^Min price/ })
const maxSlider = () => screen.getByRole('slider', { name: /^Max price/ })
// The slider range is sized from the menu, so wait for it before moving a handle.
const slidersReady = (ceiling) => waitFor(() => expect(maxSlider()).toHaveAttribute('max', String(ceiling)))

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

  it('narrows the menu by price range from the sliders', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })
    await slidersReady(150)

    fireEvent.change(minSlider(), { target: { value: '60' } })
    fireEvent.change(maxSlider(), { target: { value: '80' } })

    await waitFor(() => expect(itemHeadings()).toHaveLength(3))
    expect(itemHeadings()).toEqual(expect.arrayContaining(['Masala Dosa', 'Idli Sambar', 'Mango Lassi']))
    expect(url()).toBe('/restaurants/1?min_price=60&max_price=80')
  })

  it('applies search and max price from the URL to the inputs and the list', async () => {
    renderPage('/restaurants/1?q=dosa&max_price=100')

    await screen.findByRole('heading', { level: 1, name: 'Dosa Dash' })

    expect(itemHeadings()).toEqual(['Masala Dosa', 'Egg Dosa'])
    expect(screen.getByLabelText('Search the menu')).toHaveValue('dosa')
    expect(screen.getByText('Max price ₹100')).toBeInTheDocument()
    expect(maxSlider()).toHaveValue('100')
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

  it('has no Apply button, no hint, and only Clear filters as a plain button', async () => {
    renderPage()
    await ready()

    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
    expect(screen.queryByText(/press Apply/i)).not.toBeInTheDocument()
    expect(within(form()).getAllByRole('button').map((button) => button.textContent)).toEqual(
      expect.arrayContaining(['Clear filters']),
    )
    expect(within(form()).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('offers two sliders from 0 to the highest dish price, with live labels', async () => {
    renderPage()
    await ready()
    await slidersReady(150)

    expect(minSlider()).toHaveAttribute('min', '0')
    expect(screen.getByText('Min price ₹0')).toBeInTheDocument()
    expect(screen.getByText('Max price ₹150')).toBeInTheDocument()
    expect(maxSlider()).toHaveValue('150')
  })

  it('updates the label as a handle moves', async () => {
    renderPage()
    await ready()
    await slidersReady(150)

    fireEvent.change(minSlider(), { target: { value: '40' } })

    expect(screen.getByText('Min price ₹40')).toBeInTheDocument()
  })

  it('pushes the other handle so the minimum never passes the maximum', async () => {
    renderPage()
    await ready()
    await slidersReady(150)
    fireEvent.change(maxSlider(), { target: { value: '70' } })

    fireEvent.change(minSlider(), { target: { value: '100' } })

    expect(screen.getByText('Min price ₹70')).toBeInTheDocument()
    expect(screen.getByText('Max price ₹70')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends no price filter while both handles sit at the ends of the range', async () => {
    const spy = vi.spyOn(restaurantsApi, 'listMenu')
    renderPage()
    await ready()
    await slidersReady(150)

    fireEvent.change(minSlider(), { target: { value: '50' } })
    fireEvent.change(minSlider(), { target: { value: '0' } })
    fireEvent.change(maxSlider(), { target: { value: '150' } })

    expect(url()).toBe('/restaurants/1')
    expect(spy.mock.calls.every(([, filters]) => !filters?.min_price && !filters?.max_price)).toBe(true)
  })

  it('filters instantly after the debounce, with no button press', async () => {
    renderPage()
    await ready()
    await slidersReady(150)

    fireEvent.change(maxSlider(), { target: { value: '50' } })

    await waitFor(() => expect(url()).toBe('/restaurants/1?max_price=50'))
    await waitFor(() => expect(itemHeadings()).toEqual(expect.arrayContaining(['Medu Vada', 'Filter Coffee'])))
    expect(itemHeadings().every((name) => ['Medu Vada', 'Filter Coffee'].includes(name))).toBe(true)
  })

  it('offers All, Veg and Non-veg chips with All selected by default', async () => {
    renderPage()
    await ready()

    expect(within(form()).getByRole('radiogroup', { name: 'Diet' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Veg' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Non-veg' })).not.toBeChecked()
  })

  it('shows only non-vegetarian dishes for the Non-veg chip and writes it to the URL', async () => {
    renderPage('/restaurants/3')
    await screen.findByRole('heading', { level: 1, name: 'Burger Barn' })

    await userEvent.click(screen.getByRole('radio', { name: 'Non-veg' }))

    await waitFor(() => expect(url()).toBe('/restaurants/3?veg=non_veg'))
    await waitFor(() => expect(itemHeadings()).toEqual(['Classic Cheeseburger', 'Double Stack', 'Spicy Chicken Burger']))
    expect(screen.getByRole('radio', { name: 'Non-veg' })).toBeChecked()
  })

  it('shows only vegetarian dishes for the Veg chip, and All brings everything back', async () => {
    renderPage('/restaurants/3?veg=veg')
    await screen.findByRole('heading', { level: 1, name: 'Burger Barn' })

    expect(screen.getByRole('radio', { name: 'Veg' })).toBeChecked()
    expect(itemHeadings()).not.toContain('Classic Cheeseburger')

    await userEvent.click(screen.getByRole('radio', { name: 'All' }))

    await waitFor(() => expect(itemHeadings()).toContain('Classic Cheeseburger'))
    expect(url()).toBe('/restaurants/3')
  })

  it('still alerts on an inverted range typed into the URL and does not send it to the api', async () => {
    const spy = vi.spyOn(restaurantsApi, 'listMenu')
    renderPage('/restaurants/1?min_price=100&max_price=50')

    expect(await screen.findByRole('alert')).toHaveTextContent(/minimum price is higher than the maximum/i)
    expect(spy.mock.calls.some(([, filters]) => filters?.min_price === '100' || filters?.max_price === '50')).toBe(false)
    await waitFor(() => expect(itemHeadings().length).toBeGreaterThan(0))
  })

  it('clears the search, sliders, chips and URL with the form Clear filters button', async () => {
    renderPage('/restaurants/1?q=lassi&min_price=10&veg=veg')
    await ready()

    await userEvent.click(within(form()).getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByLabelText('Search the menu')).toHaveValue('')
    expect(screen.getByText('Min price ₹0')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(url()).toBe('/restaurants/1')
  })

  it('auto-applies the search after the debounce', async () => {
    renderPage()
    await ready()

    await userEvent.type(screen.getByLabelText('Search the menu'), 'idli')

    await waitFor(() => expect(url()).toBe('/restaurants/1?q=idli'))
  })

  it('has no accessibility violations in the filter area', async () => {
    renderPage()
    await ready()
    await slidersReady(150)

    expect(await axe(form())).toHaveNoViolations()
  })

  it('shows the restaurant logo in the header', async () => {
    const { container } = renderPage()
    await ready()

    expect(container.querySelector('header img')).toHaveAttribute('src')
  })
})
