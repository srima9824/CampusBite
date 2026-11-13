import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog.jsx'

function renderDialog(props = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const view = render(
    <ConfirmDialog
      title="Empty your cart?"
      message="Every dish goes back."
      confirmLabel="Empty cart"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  )
  return { ...view, onConfirm, onCancel }
}

describe('ConfirmDialog', () => {
  it('shows the title, message and labelled buttons', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Empty your cart?' })).toHaveTextContent('Every dish goes back.')
    expect(screen.getByRole('button', { name: 'Empty cart' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('uses a custom cancel label', () => {
    renderDialog({ cancelLabel: 'Keep my cart' })

    expect(screen.getByRole('button', { name: 'Keep my cart' })).toBeInTheDocument()
  })

  it('calls onConfirm when confirmed', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Empty cart' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancelled', async () => {
    const { onConfirm, onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    const { onCancel } = renderDialog()

    await userEvent.click(screen.getByRole('dialog'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables both buttons while loading so it cannot be confirmed twice', async () => {
    const { onConfirm } = renderDialog({ loading: true })

    await userEvent.click(screen.getByRole('button', { name: 'Empty cart' }))

    expect(screen.getByRole('button', { name: 'Empty cart' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('has no accessibility violations', async () => {
    const { container } = renderDialog()

    expect(await axe(container)).toHaveNoViolations()
  })
})
