import { describe, expect, it } from 'vitest'
import { ACTOR_TRANSITIONS, canTransition, deliveryNextAction, ORDER_STATUSES, ownerNextAction, STATUS_LABELS } from './orderStatus.js'

const VALID = [
  ['PLACED', 'ACCEPTED'],
  ['ACCEPTED', 'PREPARING'],
  ['PREPARING', 'READY'],
  ['READY', 'OUT_FOR_DELIVERY'],
  ['OUT_FOR_DELIVERY', 'DELIVERED'],
  ['PLACED', 'CANCELLED'],
]

const isValid = (from, to) => VALID.some(([a, b]) => a === from && b === to)

const allPairs = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to, isValid(from, to)]))

describe('canTransition', () => {
  it('knows seven statuses', () => {
    expect(ORDER_STATUSES).toHaveLength(7)
  })

  it.each(allPairs)('%s to %s is %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected)
  })

  it.each(['DELIVERED', 'CANCELLED'])('allows nothing out of the final status %s', (final) => {
    expect(ORDER_STATUSES.some((to) => canTransition(final, to))).toBe(false)
  })

  it.each(['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'])('does not allow cancelling from %s', (from) => {
    expect(canTransition(from, 'CANCELLED')).toBe(false)
  })
})

describe('ACTOR_TRANSITIONS', () => {
  it.each([
    ['customer', [['PLACED', 'CANCELLED']]],
    [
      'owner',
      [
        ['PLACED', 'ACCEPTED'],
        ['ACCEPTED', 'PREPARING'],
        ['PREPARING', 'READY'],
      ],
    ],
    [
      'delivery',
      [
        ['READY', 'OUT_FOR_DELIVERY'],
        ['OUT_FOR_DELIVERY', 'DELIVERED'],
      ],
    ],
  ])('lets %s make exactly its moves', (actor, moves) => {
    expect(ACTOR_TRANSITIONS[actor]).toEqual(moves)
  })

  it('only grants moves that are valid transitions, each to exactly one actor', () => {
    const granted = Object.values(ACTOR_TRANSITIONS).flat()

    expect(granted.every(([from, to]) => canTransition(from, to))).toBe(true)
    expect(granted).toHaveLength(VALID.length)
  })
})

describe('STATUS_LABELS', () => {
  it('has a label for every status', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort())
  })
})

describe('ownerNextAction', () => {
  it.each([
    ['PLACED', 'ACCEPTED', 'Accept order'],
    ['ACCEPTED', 'PREPARING', 'Start preparing'],
    ['PREPARING', 'READY', 'Mark ready'],
  ])('offers the single next step from %s', (from, status, label) => {
    expect(ownerNextAction(from)).toEqual({ status, label })
  })

  it.each(['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])('offers the owner nothing from %s', (from) => {
    expect(ownerNextAction(from)).toBeNull()
  })

  it('only proposes moves the order lifecycle allows', () => {
    const proposed = ORDER_STATUSES.map((from) => [from, ownerNextAction(from)]).filter(([, action]) => action)

    expect(proposed.every(([from, action]) => canTransition(from, action.status))).toBe(true)
  })
})

describe('deliveryNextAction', () => {
  it.each([
    ['READY', 'OUT_FOR_DELIVERY', 'Pick up order'],
    ['OUT_FOR_DELIVERY', 'DELIVERED', 'Mark delivered'],
  ])('offers the single next step from %s', (from, status, label) => {
    expect(deliveryNextAction(from)).toEqual({ status, label })
  })

  it.each(['PLACED', 'ACCEPTED', 'PREPARING', 'DELIVERED', 'CANCELLED'])('offers the partner nothing from %s', (from) => {
    expect(deliveryNextAction(from)).toBeNull()
  })

  it('only proposes moves the order lifecycle allows', () => {
    const proposed = ORDER_STATUSES.map((from) => [from, deliveryNextAction(from)]).filter(([, action]) => action)

    expect(proposed.every(([from, action]) => canTransition(from, action.status))).toBe(true)
  })
})
