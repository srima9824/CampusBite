import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Skeleton from './Skeleton.jsx'

describe('Skeleton', () => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies the requested width and height', () => {
    const { container } = render(<Skeleton width="160px" height="32px" />)
    expect(container.firstChild).toHaveStyle({ width: '160px', height: '32px' })
  })

  it.each(['line', 'block', 'circle'])('renders the %s variant', (variant) => {
    const { container } = render(<Skeleton variant={variant} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
