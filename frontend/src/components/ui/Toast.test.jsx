import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ToastProvider, useToast } from './ToastContext.jsx'

function Buttons() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Saved it')}>fire success</button>
      <button onClick={() => toast.error('Went wrong')}>fire error</button>
    </>
  )
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  )
}

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('shows a success message in the polite live region', async () => {
    const { container } = renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'fire success' }))

    const region = container.querySelector('[aria-live="polite"]')
    expect(region).toHaveTextContent('Saved it')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error message as an alert', async () => {
    renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'fire error' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Went wrong')
  })

  it('does not steal focus from the control that raised it', async () => {
    renderToasts()
    const trigger = screen.getByRole('button', { name: 'fire success' })

    await userEvent.click(trigger)

    expect(trigger).toHaveFocus()
  })

  it('stacks several toasts', async () => {
    renderToasts()

    await userEvent.click(screen.getByRole('button', { name: 'fire success' }))
    await userEvent.click(screen.getByRole('button', { name: 'fire error' }))

    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(2)
  })

  it('dismisses a toast with its Dismiss button', async () => {
    renderToasts()
    await userEvent.click(screen.getByRole('button', { name: 'fire success' }))

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText('Saved it')).not.toBeInTheDocument()
  })

  it('dismisses itself after 4 seconds', () => {
    vi.useFakeTimers()
    renderToasts()
    fireEvent.click(screen.getByRole('button', { name: 'fire success' }))

    act(() => vi.advanceTimersByTime(3900))
    expect(screen.getByText('Saved it')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))

    expect(screen.queryByText('Saved it')).not.toBeInTheDocument()
  })

  it('stays while hovered and resumes the countdown on leave', () => {
    vi.useFakeTimers()
    renderToasts()
    fireEvent.click(screen.getByRole('button', { name: 'fire success' }))
    const message = screen.getByText('Saved it')

    fireEvent.mouseEnter(message.parentElement)
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.getByText('Saved it')).toBeInTheDocument()

    fireEvent.mouseLeave(message.parentElement)
    act(() => vi.advanceTimersByTime(4100))
    expect(screen.queryByText('Saved it')).not.toBeInTheDocument()
  })

  it('stays while its Dismiss button has keyboard focus', () => {
    vi.useFakeTimers()
    renderToasts()
    fireEvent.click(screen.getByRole('button', { name: 'fire success' }))

    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }))
    act(() => vi.advanceTimersByTime(10000))

    expect(screen.getByText('Saved it')).toBeInTheDocument()
  })

  it('has no accessibility violations with toasts showing', async () => {
    const { container } = renderToasts()
    await userEvent.click(screen.getByRole('button', { name: 'fire success' }))
    await userEvent.click(screen.getByRole('button', { name: 'fire error' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('useToast', () => {
  it('throws outside a ToastProvider', () => {
    const quiet = console.error
    console.error = () => {}
    try {
      expect(() => render(<Buttons />)).toThrow(/ToastProvider/)
    } finally {
      console.error = quiet
    }
  })
})
