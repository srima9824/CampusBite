import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it } from 'vitest'
import Input from './Input.jsx'

describe('Input', () => {
  it('associates the label with the field', () => {
    render(<Input label="Campus email" />)
    expect(screen.getByLabelText('Campus email')).toBeInTheDocument()
  })

  it('links the hint to the field', () => {
    render(<Input label="Email" hint="Used for receipts" />)
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Used for receipts')
  })

  it('links the error to the field and marks it invalid', () => {
    render(<Input label="Room" error="Unknown room" />)
    const field = screen.getByLabelText('Room')
    expect(field).toHaveAccessibleDescription('Unknown room')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('describes the field with both hint and error', () => {
    render(<Input label="Room" hint="Like B-204" error="Unknown room" />)
    expect(screen.getByLabelText('Room')).toHaveAccessibleDescription('Like B-204 Unknown room')
  })

  it('is not invalid and has no description without an error or hint', () => {
    render(<Input label="Name" />)
    const field = screen.getByLabelText('Name')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(field).not.toHaveAttribute('aria-describedby')
  })

  it('accepts typed text', async () => {
    render(<Input label="Name" />)
    const field = screen.getByLabelText('Name')
    await userEvent.type(field, 'Sam')
    expect(field).toHaveValue('Sam')
  })

  it('forwards native attributes such as required and type', () => {
    render(<Input label="Email" type="email" required />)
    const field = screen.getByLabelText('Email')
    expect(field).toBeRequired()
    expect(field).toHaveAttribute('type', 'email')
  })

  it('has no accessibility violations with hint and error', async () => {
    const { container } = render(
      <>
        <Input label="Email" hint="Used for receipts" />
        <Input label="Room" error="Unknown room" />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
