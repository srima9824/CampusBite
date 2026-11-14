import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import FilterActions, { FILTER_HINT } from './FilterActions.jsx'

function renderInForm(onSubmit = vi.fn(), onClear = vi.fn()) {
  const result = render(
    <form
      aria-label="Filters"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <input aria-label="Search" />
      <FilterActions onClear={onClear} />
    </form>,
  )
  return { ...result, onSubmit, onClear }
}

describe('FilterActions', () => {
  it('exports the hint text the pages show above the fields', () => {
    expect(FILTER_HINT).toBe('Filters apply as you type, or press Apply.')
  })

  it('lists Apply before Clear filters', () => {
    renderInForm()

    const names = screen.getAllByRole('button').map((button) => button.textContent)
    expect(names).toEqual(['Apply', 'Clear filters'])
  })

  it('submits the form when Apply is clicked', async () => {
    const { onSubmit } = renderInForm()

    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits the form when Enter is pressed in a field', async () => {
    const { onSubmit } = renderInForm()

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'dosa{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('calls the clear handler without submitting', async () => {
    const { onSubmit, onClear } = renderInForm()

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderInForm()

    expect(await axe(container)).toHaveNoViolations()
  })
})
