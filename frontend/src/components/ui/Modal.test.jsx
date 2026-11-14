import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal.jsx'

function Opener({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      {open && (
        <Modal
          title="Heads up"
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          actions={<button>Got it</button>}
        >
          <p>Something to read.</p>
        </Modal>
      )}
    </>
  )
}

// jsdom never fires `cancel` for Escape, so the browser's behaviour is simulated.
const pressEscape = () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))

describe('Modal', () => {
  it('opens as a dialog named by its title with body and actions', async () => {
    render(<Opener />)

    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    const dialog = screen.getByRole('dialog', { name: 'Heads up' })
    expect(dialog).toHaveTextContent('Something to read.')
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
  })

  it('is not shown until it is mounted', () => {
    render(<Opener />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks to close on Escape and prevents the native close', async () => {
    const onClose = vi.fn()
    render(<Opener onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))
    const cancel = new Event('cancel', { cancelable: true })

    fireEvent(screen.getByRole('dialog'), cancel)

    expect(onClose).toHaveBeenCalledOnce()
    expect(cancel.defaultPrevented).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the backdrop (the dialog itself) is clicked', async () => {
    const onClose = vi.fn()
    render(<Opener onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    await userEvent.click(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays open when the content inside is clicked', async () => {
    const onClose = vi.fn()
    render(<Opener onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    await userEvent.click(screen.getByText('Something to read.'))

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the opener after it closes', async () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    await userEvent.click(opener)

    pressEscape()

    expect(opener).toHaveFocus()
  })

  it('has no accessibility violations while open', async () => {
    const { container } = render(<Opener />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    expect(await axe(container)).toHaveNoViolations()
  })
})
