import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { scrollToAnchor, useHashRoute } from './useHashRoute'
import type { Route } from './useHashRoute'

// replaceState does not fire `hashchange`, so tests start from a known URL without
// a stray event reaching the next test.
function setHash(hash: string): void {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
}

beforeEach(() => setHash(''))

describe('useHashRoute parsing', () => {
  test.each<[hash: string, route: Route]>([
    ['', 'home'],
    ['#', 'home'],
    ['#/', 'home'],
    ['#/profile', 'profile'],
    ['#/outage', 'outage'],
    ['#/plan', 'plan'],
    ['#/method', 'method'],
  ])('%j is the %s route', (hash, route) => {
    setHash(hash)
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.route).toBe(route)
    expect(result.current.anchor).toBeNull()
    expect([...result.current.params]).toEqual([])
  })

  test('#/outage?autoplay=1 parses to route outage with the query params', () => {
    setHash('#/outage?autoplay=1')
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.route).toBe('outage')
    expect(result.current.params.get('autoplay')).toBe('1')
    expect(result.current.anchor).toBeNull()
  })

  test('#/method#src-cost.dieselNgnPerLitre parses to route method with the anchor', () => {
    setHash('#/method#src-cost.dieselNgnPerLitre')
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.route).toBe('method')
    expect(result.current.anchor).toBe('src-cost.dieselNgnPerLitre')
    expect([...result.current.params]).toEqual([])
  })

  test('query and anchor can appear together', () => {
    setHash('#/method?from=plan#src-stat.nepaCuts')
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.route).toBe('method')
    expect(result.current.params.get('from')).toBe('plan')
    expect(result.current.anchor).toBe('src-stat.nepaCuts')
  })

  test('an empty anchor counts as no anchor', () => {
    setHash('#/method#')
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.anchor).toBeNull()
  })

  test('params keep the same identity until the hash changes', () => {
    setHash('#/outage?autoplay=1')
    const { result, rerender } = renderHook(() => useHashRoute())
    const first = result.current.params
    rerender()
    expect(result.current.params).toBe(first)
  })
})

describe('useHashRoute unknown routes', () => {
  test.each(['#/nope', '#/nope?x=1#frag', '#/Profile', '#/home', '#/profile/extra', '#nope'])(
    '%s falls back to home and rewrites the URL to #/',
    (hash) => {
      setHash(hash)
      const { result } = renderHook(() => useHashRoute())
      expect(result.current.route).toBe('home')
      expect(result.current.anchor).toBeNull()
      expect([...result.current.params]).toEqual([])
      expect(window.location.hash).toBe('#/')
    },
  )

  test.each(['', '#', '#/', '#/plan'])('%j is left as typed', (hash) => {
    setHash(hash)
    const replaceState = vi.spyOn(window.history, 'replaceState')
    try {
      renderHook(() => useHashRoute())
      expect(replaceState).not.toHaveBeenCalled()
    } finally {
      replaceState.mockRestore()
    }
  })

  test('the rewrite adds no history entry', () => {
    setHash('#/nope')
    const lengthBefore = window.history.length
    renderHook(() => useHashRoute())
    expect(window.history.length).toBe(lengthBefore)
  })
})

describe('useHashRoute changes', () => {
  test('follows hashchange events', () => {
    const { result } = renderHook(() => useHashRoute())
    expect(result.current.route).toBe('home')

    setHash('#/plan')
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current.route).toBe('plan')
  })

  test('navigate sets the hash and the route follows', async () => {
    const { result } = renderHook(() => useHashRoute())
    act(() => result.current.navigate('profile'))
    expect(window.location.hash).toBe('#/profile')
    await waitFor(() => expect(result.current.route).toBe('profile'))
  })

  test('navigate home uses #/', async () => {
    setHash('#/plan')
    const { result } = renderHook(() => useHashRoute())
    act(() => result.current.navigate('home'))
    expect(window.location.hash).toBe('#/')
    await waitFor(() => expect(result.current.route).toBe('home'))
  })

  test('navigate appends the query, with or without a leading ?', async () => {
    const { result } = renderHook(() => useHashRoute())
    act(() => result.current.navigate('outage', 'autoplay=1'))
    expect(window.location.hash).toBe('#/outage?autoplay=1')
    await waitFor(() => expect(result.current.params.get('autoplay')).toBe('1'))

    act(() => result.current.navigate('outage', '?autoplay=0'))
    expect(window.location.hash).toBe('#/outage?autoplay=0')
    await waitFor(() => expect(result.current.params.get('autoplay')).toBe('0'))
  })

  test('navigate with an empty query adds no ?', () => {
    const { result } = renderHook(() => useHashRoute())
    act(() => result.current.navigate('plan', ''))
    expect(window.location.hash).toBe('#/plan')
  })

  test('navigate keeps the same identity across renders', () => {
    const { result, rerender } = renderHook(() => useHashRoute())
    const first = result.current.navigate
    rerender()
    expect(result.current.navigate).toBe(first)
  })

  test('stops listening after unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    try {
      const { unmount } = renderHook(() => useHashRoute())
      unmount()
      expect(removeListener).toHaveBeenCalledWith('hashchange', expect.any(Function))
    } finally {
      removeListener.mockRestore()
    }
  })
})

describe('scrollToAnchor', () => {
  const scrollIntoView = vi.fn()

  // jsdom does not implement scrollIntoView.
  beforeEach(() => {
    scrollIntoView.mockClear()
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    document.body.replaceChildren()
  })

  test('scrolls to an element whose id contains dots', () => {
    const target = document.createElement('div')
    target.id = 'src-cost.dieselNgnPerLitre'
    document.body.append(target)

    scrollToAnchor('src-cost.dieselNgnPerLitre')

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(target)
  })

  test('does nothing when the element is missing or the anchor is null', () => {
    expect(() => scrollToAnchor('src-missing')).not.toThrow()
    expect(() => scrollToAnchor(null)).not.toThrow()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
