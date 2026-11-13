import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import useAsync from './useAsync.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useAsync', () => {
  it('moves from loading to success with the resolved data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('soup'), []))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('soup')
    expect(result.current.error).toBeNull()
  })

  it('reports the rejection as an error', async () => {
    const failure = new Error('kitchen closed')
    const { result } = renderHook(() => useAsync(() => Promise.reject(failure), []))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe(failure)
    expect(result.current.data).toBeNull()
  })

  it('runs the function again and shows loading when reload is called', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useAsync(fn, []))
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.reload())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fetches again when a dependency changes', async () => {
    const fn = vi.fn((term) => Promise.resolve(`result ${term}`))
    const { result, rerender } = renderHook(({ term }) => useAsync(() => fn(term), [term]), {
      initialProps: { term: 'a' },
    })
    await waitFor(() => expect(result.current.data).toBe('result a'))

    rerender({ term: 'b' })

    await waitFor(() => expect(result.current.data).toBe('result b'))
  })

  it('does not refetch when rerendered with the same dependencies', async () => {
    const fn = vi.fn(() => Promise.resolve('x'))
    const { result, rerender } = renderHook(() => useAsync(fn, ['same']))
    await waitFor(() => expect(result.current.status).toBe('success'))

    rerender()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale result that arrives after the dependencies changed', async () => {
    const first = deferred()
    const second = deferred()
    const pending = { a: first, b: second }
    const { result, rerender } = renderHook(({ term }) => useAsync(() => pending[term].promise, [term]), {
      initialProps: { term: 'a' },
    })

    rerender({ term: 'b' })
    await act(async () => second.resolve('fresh'))
    await waitFor(() => expect(result.current.data).toBe('fresh'))
    await act(async () => first.resolve('stale'))

    expect(result.current.data).toBe('fresh')
    expect(result.current.status).toBe('success')
  })
})
