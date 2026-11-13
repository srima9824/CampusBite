import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ORDER_STATUSES, STATUS_LABELS } from '../api/orderStatus.js'
import OrderStatusBadge from './OrderStatusBadge.jsx'

describe('OrderStatusBadge', () => {
  it.each([
    ['PLACED', 'Placed'],
    ['ACCEPTED', 'Accepted'],
    ['PREPARING', 'Preparing'],
    ['READY', 'Ready'],
    ['OUT_FOR_DELIVERY', 'Out for delivery'],
    ['DELIVERED', 'Delivered'],
    ['CANCELLED', 'Cancelled'],
  ])('shows %s as the text "%s"', (status, label) => {
    render(<OrderStatusBadge status={status} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('has a label for every known status', () => {
    expect(ORDER_STATUSES.every((status) => STATUS_LABELS[status])).toBe(true)
  })
})
