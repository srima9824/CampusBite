import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import Button from './Button.jsx'

describe('Button', () => {
  it('shows its label', () => {
    render(<Button>Order now</Button>)
    expect(screen.getByRole('button', { name: 'Order now' })).toBeInTheDocument()
  })

  it('defaults to type button so it never submits a form by accident', () => {
    render(<Button>Order now</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it.each(['primary', 'secondary', 'ghost', 'danger'])('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeEnabled()
  })

  it('calls the handler when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ignores clicks when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is busy, disabled and ignores clicks while loading', async () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Go</Button>)
    const button = screen.getByRole('button')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('is not marked busy when idle', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Button>Go</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
