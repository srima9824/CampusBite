import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import MenuItemForm from './MenuItemForm.jsx'

function renderForm(props = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  const view = render(
    <MenuItemForm submitLabel="Add to menu" onSubmit={onSubmit} onCancel={onCancel} categories={['Dosas', 'Drinks']} {...props} />,
  )
  return { ...view, onSubmit, onCancel }
}

const name = () => screen.getByLabelText('Name')
const category = () => screen.getByLabelText('Category')
const price = () => screen.getByLabelText('Price (Rs.)')
const submit = () => screen.getByRole('button', { name: 'Add to menu' })

async function fillValid() {
  await userEvent.type(name(), 'Test Dosa')
  await userEvent.type(category(), 'Dosas')
  await userEvent.type(price(), '99.50')
}

describe('MenuItemForm', () => {
  it('starts empty and available for ordering', () => {
    renderForm()

    expect(name()).toHaveValue('')
    expect(price()).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Available for ordering' })).toBeChecked()
  })

  it('starts as vegetarian and submits is_veg false when unticked', async () => {
    const { onSubmit } = renderForm()
    const veg = screen.getByRole('checkbox', { name: 'Vegetarian' })
    expect(veg).toBeChecked()
    await fillValid()

    await userEvent.click(veg)
    await userEvent.click(submit())

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ is_veg: false }))
  })

  it('prefills from initial values', () => {
    renderForm({
      initialValues: { name: 'Cheese Dosa', description: 'Melted', category: 'Dosas', price: 120, is_available: false },
    })

    expect(name()).toHaveValue('Cheese Dosa')
    expect(screen.getByLabelText('Description')).toHaveValue('Melted')
    expect(price()).toHaveValue('120')
    expect(screen.getByRole('checkbox', { name: 'Available for ordering' })).not.toBeChecked()
  })

  it('offers the existing categories as suggestions', () => {
    const { container } = renderForm()

    expect([...container.querySelectorAll('datalist option')].map((option) => option.value)).toEqual(['Dosas', 'Drinks'])
    expect(category()).toHaveAttribute('list')
  })

  it('submits the typed values with a numeric price', async () => {
    const { onSubmit } = renderForm()
    await fillValid()

    await userEvent.click(submit())

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Dosa',
      description: '',
      category: 'Dosas',
      price: 99.5,
      is_available: true,
      is_veg: true,
    })
  })

  it('shows a message under each bad field, focuses the first and does not submit', async () => {
    const { onSubmit } = renderForm()

    await userEvent.click(submit())

    expect(onSubmit).not.toHaveBeenCalled()
    expect(name()).toHaveAccessibleDescription(/name of 2 to 80/)
    expect(category()).toHaveAccessibleDescription(/Pick a category/)
    expect(price()).toHaveAccessibleDescription(/price above 0/)
    expect(name()).toHaveAttribute('aria-invalid', 'true')
    expect(name()).toHaveFocus()
  })

  it('flags an over-long description under the textarea', async () => {
    renderForm()
    await fillValid()
    await userEvent.click(screen.getByLabelText('Description'))
    await userEvent.paste('x'.repeat(301))

    await userEvent.click(submit())

    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription(/300 characters or fewer/)
  })

  it('puts per-field messages from a rejected submit under the matching inputs', async () => {
    const duplicate = new ApiError(409, 'duplicate_name', 'Your menu already has a dish with that name.', {
      name: 'Your menu already has a dish with that name.',
    })
    const { onSubmit } = renderForm()
    onSubmit.mockRejectedValueOnce(duplicate)
    await fillValid()

    await userEvent.click(submit())

    expect(await screen.findByText('Your menu already has a dish with that name.')).toBeInTheDocument()
    expect(name()).toHaveFocus()
    expect(submit()).toBeEnabled()
  })

  it('shows a form-level alert when the failure has no fields', async () => {
    const { onSubmit } = renderForm()
    onSubmit.mockRejectedValueOnce(new Error('The pass is closed.'))
    await fillValid()

    await userEvent.click(submit())

    expect(await screen.findByRole('alert')).toHaveTextContent('The pass is closed.')
  })

  it('calls onCancel from Cancel without submitting', async () => {
    const { onSubmit, onCancel } = renderForm()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('has no accessibility violations, including with errors showing', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()

    await userEvent.click(submit())

    expect(await axe(container)).toHaveNoViolations()
  })
})
