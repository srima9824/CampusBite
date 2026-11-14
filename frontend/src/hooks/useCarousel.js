import { useEffect, useRef, useState } from 'react'

const SWIPE_THRESHOLD_PX = 50

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Auto-advance runs only while nothing asks it to stop: hover, focus inside, or reduced motion. `live` tells screen readers to hear slide changes only when a person drove them.
export default function useCarousel(count, intervalMs) {
  const [index, setIndex] = useState(0)
  const [reducedMotion] = useState(prefersReducedMotion)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [manual, setManual] = useState(false)
  const swipeStart = useRef(null)
  const swiped = useRef(false)

  const current = count > 0 ? index % count : 0
  const running = !reducedMotion && !hovered && !focused && count > 1

  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setIndex((value) => (value + 1) % count), intervalMs)
    return () => clearInterval(timer)
    // `current` restarts the countdown after a manual change.
  }, [running, count, intervalMs, current])

  function goTo(next) {
    setManual(true)
    setIndex(((next % count) + count) % count)
  }

  const swipe = {
    onPointerDown(event) {
      swipeStart.current = event.clientX
      swiped.current = false
    },
    onPointerUp(event) {
      if (swipeStart.current == null) return
      const distance = event.clientX - swipeStart.current
      swipeStart.current = null
      if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return
      swiped.current = true
      goTo(current + (distance < 0 ? 1 : -1))
    },
    // A swipe that ends on the slide link must not also open it.
    onClickCapture(event) {
      if (!swiped.current) return
      swiped.current = false
      event.preventDefault()
    },
  }

  return {
    index: current,
    live: running && !manual ? 'off' : 'polite',
    next: () => goTo(current + 1),
    prev: () => goTo(current - 1),
    goTo,
    setHovered,
    setFocused,
    swipe,
  }
}
