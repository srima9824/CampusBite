import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import * as restaurantsApi from '../api/restaurants.js'
import { resetStore, setLatency } from '../api/testing.js'
import RestaurantCarousel from './RestaurantCarousel.jsx'

function renderCarousel() {
  return render(
    <MemoryRouter>
      <RestaurantCarousel />
    </MemoryRouter>,
  )
}

async function loaded() {
  renderCarousel()
  const region = await screen.findByRole('region', { name: 'Featured kitchens' })
  return region
}

// Inactive slides are aria-hidden, so the only reachable slide link is the current one.
const currentLink = () => screen.getByRole('link', { name: /see the menu$/ })
const currentName = () => currentLink().textContent
const liveValue = (region) => region.querySelector('[aria-live]').getAttribute('aria-live')
// Clicking a control leaves the pointer and focus inside, which pauses; step out of both.
async function leave(region) {
  await userEvent.unhover(region)
  await userEvent.click(document.body)
}
const tick = (ms) => act(() => vi.advanceTimersByTime(ms))

function stubReducedMotion(matches) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  resetStore()
  setLatency(0)
  vi.restoreAllMocks()
  // Only the carousel timer is faked; the mock api keeps its real timers.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('RestaurantCarousel structure', () => {
  it('is a carousel region labelled Featured kitchens', async () => {
    const region = await loaded()

    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
  })

  it('labels each slide "N of M: name" and exposes only the first one', async () => {
    const region = await loaded()

    expect(within(region).getByRole('group', { name: '1 of 8: Dosa Dash' })).toHaveAttribute(
      'aria-roledescription',
      'slide',
    )
    expect(within(region).getAllByRole('group')).toHaveLength(1)
    expect(region.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(8)
  })

  it('makes every slide link to its restaurant menu', async () => {
    const region = await loaded()
    const links = [...region.querySelectorAll('a')]

    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      Array.from({ length: 8 }, (_, index) => `/restaurants/${index + 1}`),
    )
    expect(links[0]).toHaveAccessibleName('Dosa Dash, see the menu')
  })

  it('shows one decorative photo per slide and a cuisine badge', async () => {
    const region = await loaded()

    const photos = region.querySelectorAll('img[alt=""]')
    expect(photos.length).toBeGreaterThanOrEqual(8)
    expect(within(region).getByText('South Indian')).toBeInTheDocument()
  })

  it('shows a loading status first', () => {
    renderCarousel()

    expect(screen.getByRole('status', { name: 'Loading featured kitchens' })).toBeInTheDocument()
  })

  it('shows an error with Retry and recovers on retry', async () => {
    vi.spyOn(restaurantsApi, 'listRestaurants').mockRejectedValueOnce(new Error('No kitchens today.'))
    renderCarousel()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No kitchens today.')

    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('region', { name: 'Featured kitchens' })).toBeInTheDocument()
  })

  it('renders nothing when there are no restaurants', async () => {
    vi.spyOn(restaurantsApi, 'listRestaurants').mockResolvedValue({ items: [], total: 0, page: 1, page_size: 8 })
    const { container } = renderCarousel()

    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()
  })

  it('asks the api for eight restaurants', async () => {
    const spy = vi.spyOn(restaurantsApi, 'listRestaurants')

    await loaded()

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ page_size: 8 }))
  })

  it('has no accessibility violations once loaded', async () => {
    const region = await loaded()

    expect(await axe(region)).toHaveNoViolations()
  })
})

describe('RestaurantCarousel controls', () => {
  it('moves to the next and previous kitchen and wraps around both ends', async () => {
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Previous kitchen' }))
    expect(currentName()).toBe('Wrap Star')

    await userEvent.click(screen.getByRole('button', { name: 'Next kitchen' }))
    expect(currentName()).toBe('Dosa Dash')

    await userEvent.click(screen.getByRole('button', { name: 'Next kitchen' }))
    expect(currentName()).toBe('Noodle Nook')
  })

  it('jumps to a kitchen from its dot and marks that dot current', async () => {
    await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Show kitchen 4: Pizza Pronto' }))

    expect(currentName()).toBe('Pizza Pronto')
    expect(screen.getByRole('button', { name: 'Show kitchen 4: Pizza Pronto' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Show kitchen 1: Dosa Dash' })).not.toHaveAttribute('aria-current')
  })

  it('changes slide with the arrow keys while focus is inside', async () => {
    await loaded()
    await userEvent.tab()

    await userEvent.keyboard('{ArrowRight}')
    expect(currentName()).toBe('Noodle Nook')

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(currentName()).toBe('Wrap Star')
  })
})

describe('RestaurantCarousel auto-advance', () => {
  it('advances to the next kitchen every five seconds', async () => {
    await loaded()

    tick(4999)
    expect(currentName()).toBe('Dosa Dash')

    tick(1)
    expect(currentName()).toBe('Noodle Nook')

    tick(5000)
    expect(currentName()).toBe('Burger Barn')
  })

  it('restarts the five second countdown after a manual change', async () => {
    const region = await loaded()
    tick(3000)

    await userEvent.click(screen.getByRole('button', { name: 'Next kitchen' }))
    await leave(region)
    tick(3000)
    expect(currentName()).toBe('Noodle Nook')

    tick(2000)
    expect(currentName()).toBe('Burger Barn')
  })

  it('stops with Pause slideshow and resumes with Play slideshow', async () => {
    const region = await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }))
    await leave(region)
    tick(20000)
    expect(currentName()).toBe('Dosa Dash')

    await userEvent.click(screen.getByRole('button', { name: 'Play slideshow' }))
    await leave(region)
    tick(5000)
    expect(currentName()).toBe('Noodle Nook')
  })

  it('pauses while the pointer hovers and resumes when it leaves', async () => {
    const region = await loaded()

    await userEvent.hover(region)
    tick(15000)
    expect(currentName()).toBe('Dosa Dash')

    await userEvent.unhover(region)
    tick(5000)
    expect(currentName()).toBe('Noodle Nook')
  })

  it('pauses while focus is inside and resumes when focus leaves', async () => {
    await loaded()

    await userEvent.tab()
    tick(15000)
    expect(currentName()).toBe('Dosa Dash')

    await userEvent.click(document.body)
    tick(5000)
    expect(currentName()).toBe('Noodle Nook')
  })

  it('starts paused and never advances when the user prefers reduced motion', async () => {
    stubReducedMotion(true)
    await loaded()

    tick(30000)

    expect(currentName()).toBe('Dosa Dash')
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument()
  })

  it('auto-advances when reduced motion is not requested', async () => {
    stubReducedMotion(false)
    await loaded()

    tick(5000)

    expect(currentName()).toBe('Noodle Nook')
  })
})

describe('RestaurantCarousel live region', () => {
  it('is off while the slideshow cycles on its own', async () => {
    const region = await loaded()

    expect(liveValue(region)).toBe('off')
  })

  it('is polite when paused with the toggle', async () => {
    const region = await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }))

    expect(liveValue(region)).toBe('polite')
  })

  it('is polite while hovered', async () => {
    const region = await loaded()

    await userEvent.hover(region)

    expect(liveValue(region)).toBe('polite')
  })

  it('is polite after a manual change and stays so as the slideshow keeps cycling', async () => {
    const region = await loaded()

    await userEvent.click(screen.getByRole('button', { name: 'Next kitchen' }))
    await leave(region)
    tick(5000)

    expect(liveValue(region)).toBe('polite')
  })

  it('is polite from the start under reduced motion', async () => {
    stubReducedMotion(true)
    const region = await loaded()

    expect(liveValue(region)).toBe('polite')
  })
})
