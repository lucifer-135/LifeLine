import { act, renderHook } from '@testing-library/react'
import { createElement, StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { usePlayback } from './usePlayback'

interface Options {
  totalSteps: number
  resetKey: string
  autoplay: boolean
}

const defaults: Options = { totalSteps: 96, resetKey: 'a', autoplay: true }

const setup = (options: Partial<Options> = {}) =>
  renderHook((props: Options) => usePlayback(props), {
    initialProps: { ...defaults, ...options },
  })

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

// --- brief tests ---

test('usePlayback advances at 1× every 400ms and stops at end', () => {
  const { result } = setup()
  expect(result.current.step).toBe(0)
  expect(result.current.playing).toBe(true)

  advance(400)
  expect(result.current.step).toBe(1)

  advance(400 * 200)
  expect(result.current.step).toBe(95)
  expect(result.current.playing).toBe(false)
})

test('resetKey change resets to 0', () => {
  const { result, rerender } = setup()
  advance(400 * 10)
  expect(result.current.step).toBe(10)

  rerender({ ...defaults, resetKey: 'b' })
  expect(result.current.step).toBe(0)
})

test('no interval leaks after unmount', () => {
  const { unmount } = setup()
  expect(vi.getTimerCount()).toBe(1)

  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

// --- initial state ---

describe('initial state', () => {
  test('starts at step 0, 1×, playing as autoplay says', () => {
    const playing = setup({ autoplay: true }).result.current
    expect([playing.step, playing.speed, playing.playing]).toEqual([0, 1, true])

    const paused = setup({ autoplay: false }).result.current
    expect([paused.step, paused.speed, paused.playing]).toEqual([0, 1, false])
  })

  test('autoplay false never starts a timer', () => {
    setup({ autoplay: false })
    expect(vi.getTimerCount()).toBe(0)
  })
})

// --- timing ---

describe('speed', () => {
  test('4× advances every 100 ms', () => {
    const { result } = setup()
    act(() => result.current.setSpeed(4))
    expect(result.current.speed).toBe(4)

    advance(100)
    expect(result.current.step).toBe(1)
    advance(300)
    expect(result.current.step).toBe(4)
  })

  test('16× advances every 25 ms', () => {
    const { result } = setup()
    act(() => result.current.setSpeed(16))

    advance(25)
    expect(result.current.step).toBe(1)
    advance(25 * 9)
    expect(result.current.step).toBe(10)
  })

  test('changing speed re-creates the one interval at the new period', () => {
    const { result } = setup()
    advance(400)
    expect(result.current.step).toBe(1)

    act(() => result.current.setSpeed(16))
    expect(vi.getTimerCount()).toBe(1)

    advance(24)
    expect(result.current.step).toBe(1)
    advance(1)
    expect(result.current.step).toBe(2)

    act(() => result.current.setSpeed(1))
    expect(vi.getTimerCount()).toBe(1)
    advance(399)
    expect(result.current.step).toBe(2)
    advance(1)
    expect(result.current.step).toBe(3)
  })
})

// --- play, pause, toggle ---

describe('play and pause', () => {
  test('pause stops advancing and leaves no timer', () => {
    const { result } = setup()
    advance(400 * 3)
    expect(result.current.step).toBe(3)

    act(() => result.current.pause())
    expect(result.current.playing).toBe(false)
    expect(vi.getTimerCount()).toBe(0)

    advance(400 * 10)
    expect(result.current.step).toBe(3)
  })

  test('play resumes from the paused step', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.seek(20))
    act(() => result.current.play())
    expect(result.current.playing).toBe(true)

    advance(400)
    expect(result.current.step).toBe(21)
  })

  test('toggle flips playing', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.toggle())
    expect(result.current.playing).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    act(() => result.current.toggle())
    expect(result.current.playing).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('play at the last step restarts from 0', () => {
    const { result } = setup()
    advance(400 * 200)
    expect(result.current.step).toBe(95)
    expect(result.current.playing).toBe(false)

    act(() => result.current.play())
    expect(result.current.step).toBe(0)
    expect(result.current.playing).toBe(true)

    advance(400)
    expect(result.current.step).toBe(1)
  })

  test('toggle at the last step also restarts from 0', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.seek(95))
    act(() => result.current.toggle())
    expect(result.current.step).toBe(0)
    expect(result.current.playing).toBe(true)
  })

  test('reaching the end clears the timer', () => {
    setup()
    advance(400 * 200)
    expect(vi.getTimerCount()).toBe(0)
  })
})

// --- seek ---

describe('seek', () => {
  test('moves to the step', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.seek(42))
    expect(result.current.step).toBe(42)
  })

  test('clamps to 0 and totalSteps - 1', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.seek(-5))
    expect(result.current.step).toBe(0)

    act(() => result.current.seek(500))
    expect(result.current.step).toBe(95)

    act(() => result.current.seek(Infinity))
    expect(result.current.step).toBe(95)
  })

  test('ignores NaN so the step is never NaN', () => {
    const { result } = setup({ autoplay: false })
    act(() => result.current.seek(10))
    act(() => result.current.seek(Number.NaN))
    expect(result.current.step).toBe(10)
  })

  test('keeps the playing state', () => {
    const playing = setup({ autoplay: true })
    act(() => playing.result.current.seek(30))
    expect(playing.result.current.playing).toBe(true)
    advance(400)
    expect(playing.result.current.step).toBe(31)

    const paused = setup({ autoplay: false })
    act(() => paused.result.current.seek(30))
    expect(paused.result.current.playing).toBe(false)
    advance(400 * 5)
    expect(paused.result.current.step).toBe(30)
  })

  test('uses totalSteps for the upper bound', () => {
    const { result } = setup({ autoplay: false, totalSteps: 10 })
    act(() => result.current.seek(50))
    expect(result.current.step).toBe(9)
  })
})

// --- resetKey ---

describe('resetKey', () => {
  test('pauses when autoplay is false', () => {
    const { result, rerender } = setup({ autoplay: false })
    act(() => result.current.play())
    advance(400 * 5)
    expect(result.current.step).toBe(5)

    rerender({ ...defaults, autoplay: false, resetKey: 'b' })
    expect(result.current.step).toBe(0)
    expect(result.current.playing).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('starts playing again when autoplay is true', () => {
    const { result, rerender } = setup()
    act(() => result.current.pause())
    advance(400 * 5)

    rerender({ ...defaults, resetKey: 'b' })
    expect(result.current.step).toBe(0)
    expect(result.current.playing).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    advance(400)
    expect(result.current.step).toBe(1)
  })

  test('reset after reaching the end plays again from 0', () => {
    const { result, rerender } = setup()
    advance(400 * 200)
    expect(result.current.playing).toBe(false)

    rerender({ ...defaults, resetKey: 'b' })
    expect(result.current.step).toBe(0)
    expect(result.current.playing).toBe(true)
  })

  test('a rerender with the same key changes nothing', () => {
    const { result, rerender } = setup()
    advance(400 * 5)
    rerender({ ...defaults })
    expect(result.current.step).toBe(5)
    expect(vi.getTimerCount()).toBe(1)
  })
})

// --- stability and StrictMode ---

describe('callbacks and StrictMode', () => {
  test('callbacks keep the same identity across renders', () => {
    const { result } = setup()
    const first = result.current
    advance(400 * 3)
    act(() => result.current.setSpeed(4))
    const later = result.current

    expect(later.play).toBe(first.play)
    expect(later.pause).toBe(first.pause)
    expect(later.toggle).toBe(first.toggle)
    expect(later.setSpeed).toBe(first.setSpeed)
    expect(later.seek).toBe(first.seek)
  })

  test('does not double-run under StrictMode', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children)
    const { result, unmount } = renderHook(() => usePlayback(defaults), { wrapper })
    expect(vi.getTimerCount()).toBe(1)

    advance(400)
    expect(result.current.step).toBe(1)
    advance(400 * 4)
    expect(result.current.step).toBe(5)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
