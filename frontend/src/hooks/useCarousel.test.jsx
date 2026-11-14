import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useCarousel from './useCarousel.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const swipeBy = (result, from, to) => {
  act(() => result.current.swipe.onPointerDown({ clientX: from }))
  act(() => result.current.swipe.onPointerUp({ clientX: to }))
}

describe('useCarousel', () => {
  it('starts on the first slide, running, with the live region off', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    expect(result.current).toMatchObject({ index: 0, live: 'off' })
  })

  it('wraps next and prev around both ends', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    act(() => result.current.prev())
    expect(result.current.index).toBe(2)

    act(() => result.current.next())
    expect(result.current.index).toBe(0)
  })

  it('advances on the interval and wraps', () => {
    const { result } = renderHook(() => useCarousel(2, 1000))

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.index).toBe(1)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.index).toBe(0)
  })

  it('does not cycle a single slide', () => {
    const { result } = renderHook(() => useCarousel(1, 1000))

    act(() => vi.advanceTimersByTime(5000))

    expect(result.current.index).toBe(0)
    expect(result.current.live).toBe('polite')
  })

  it('stays on index 0 with no slides', () => {
    const { result } = renderHook(() => useCarousel(0, 1000))

    expect(result.current.index).toBe(0)
  })

  it('stops advancing while hovered or focused', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    act(() => result.current.setHovered(true))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.index).toBe(0)

    act(() => result.current.setHovered(false))
    act(() => result.current.setFocused(true))
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current.index).toBe(0)
  })

  it('goes polite after a manual change and stays polite as it keeps cycling', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    act(() => result.current.goTo(2))
    expect(result.current.live).toBe('polite')

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.live).toBe('polite')
  })

  it('exposes no pause controls', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    expect(result.current).not.toHaveProperty('paused')
    expect(result.current).not.toHaveProperty('togglePause')
  })

  it('resumes advancing once hover and focus both end', () => {
    const { result } = renderHook(() => useCarousel(3, 2000))
    act(() => result.current.setHovered(true))
    act(() => result.current.setFocused(true))
    act(() => result.current.setHovered(false))
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current.index).toBe(0)

    act(() => result.current.setFocused(false))
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.index).toBe(1)
  })

  it('never advances when matchMedia reports reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))

    const { result } = renderHook(() => useCarousel(3, 1000))
    act(() => vi.advanceTimersByTime(5000))

    expect(result.current).toMatchObject({ index: 0, live: 'polite' })
  })

  it('changes slide on a swipe of at least 50px and ignores a short drag', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))

    swipeBy(result, 100, 60)
    expect(result.current.index).toBe(0)

    swipeBy(result, 200, 100)
    expect(result.current.index).toBe(1)

    swipeBy(result, 100, 200)
    expect(result.current.index).toBe(0)
  })

  it('cancels the click that ends a swipe', () => {
    const { result } = renderHook(() => useCarousel(3, 1000))
    swipeBy(result, 200, 100)
    const event = { preventDefault: vi.fn() }

    act(() => result.current.swipe.onClickCapture(event))

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
