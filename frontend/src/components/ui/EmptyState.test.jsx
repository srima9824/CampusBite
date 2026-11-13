import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EmptyState from './EmptyState.jsx'

describe('EmptyState', () => {
  it('shows the title as a level 2 heading by default', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing here' })).toBeInTheDocument()
  })

  it('shows the description', () => {
    render(<EmptyState title="Nothing here" description="Add a snack" />)
    expect(screen.getByText('Add a snack')).toBeInTheDocument()
  })

  it('renders the action', () => {
    render(<EmptyState title="Nothing here" action={<button type="button">Find food</button>} />)
    expect(screen.getByRole('button', { name: 'Find food' })).toBeInTheDocument()
  })

  it('uses a custom heading level', () => {
    render(<EmptyState title="Nothing here" headingLevel={1} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nothing here' })).toBeInTheDocument()
  })
})
