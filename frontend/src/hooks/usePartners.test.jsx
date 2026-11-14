import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetAuthWorld, signInAs } from '../test/helpers.jsx'
import usePartners from './usePartners.js'

beforeEach(resetAuthWorld)

describe('usePartners', () => {
  it('loads the delivery partner pool for an owner', async () => {
    signInAs(6, 'OWNER')

    const { result } = renderHook(() => usePartners())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.map((partner) => partner.name)).toEqual(['Sam Okafor', 'Priya Nair', 'Jonah Reyes'])
  })

  it('reports an error when the viewer is not an owner', async () => {
    signInAs(1)

    const { result } = renderHook(() => usePartners())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.status).toBe(403)
  })
})
