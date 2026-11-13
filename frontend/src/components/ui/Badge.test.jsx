import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Badge from './Badge.jsx'

describe('Badge', () => {
  it.each(['neutral', 'success', 'warning', 'danger', 'info'])(
    'shows its text for the %s tone',
    (tone) => {
      render(<Badge tone={tone}>Ready</Badge>)
      expect(screen.getByText('Ready')).toBeVisible()
    },
  )

  it('shows its text without a tone', () => {
    render(<Badge>Ready</Badge>)
    expect(screen.getByText('Ready')).toBeInTheDocument()
  })
})
