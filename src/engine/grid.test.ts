import { expect, test } from 'vitest'
import { generateGridPattern, longestOutageHours } from './grid'

test('grid pattern has exact up-step count', () =>
  [0, 4, 6, 12.5, 20, 24].forEach((h) =>
    expect(generateGridPattern(h, 2026).up.filter(Boolean)).toHaveLength(Math.round(h * 4)),
  ))

test('grid pattern deterministic per seed', () => {
  expect(generateGridPattern(6, 7)).toEqual(generateGridPattern(6, 7))
  expect(generateGridPattern(6, 7)).not.toEqual(generateGridPattern(6, 8))
})

test('longest outage: all up = 0, all down = 24, wraps midnight', () => {
  expect(longestOutageHours({ up: Array(96).fill(true) })).toBe(0)
  expect(longestOutageHours({ up: Array(96).fill(false) })).toBe(24)
  const up = Array(96).fill(true)
  for (let s = 88; s < 96; s++) up[s] = false
  for (let s = 0; s < 8; s++) up[s] = false
  expect(longestOutageHours({ up })).toBe(4)
})

test('grid hours 24 is all up and 0 is all down, even when out of range', () => {
  expect(generateGridPattern(24, 2026).up.every(Boolean)).toBe(true)
  expect(generateGridPattern(0, 2026).up.some(Boolean)).toBe(false)
  expect(generateGridPattern(30, 2026).up.every(Boolean)).toBe(true)
  expect(generateGridPattern(-3, 2026).up.some(Boolean)).toBe(false)
})

// Counts outage blocks treating the day as a circle, so a block crossing midnight is one.
function outageBlocks(up: boolean[]): number {
  return up.filter((isUp, i) => !isUp && up[(i + up.length - 1) % up.length]).length
}

test('grid pattern is 96 steps made of at most 3 outage blocks', () => {
  for (const h of [1, 4, 6, 12.5, 20, 23.75]) {
    for (const seed of [1, 7, 2026, 99999]) {
      const { up } = generateGridPattern(h, seed)
      expect(up).toHaveLength(96)
      const blocks = outageBlocks(up)
      expect(blocks).toBeGreaterThanOrEqual(1)
      expect(blocks).toBeLessThanOrEqual(3)
    }
  }
})

test('every up count from 1 to 95 steps keeps exact counts and min(3, up, down) blocks', () => {
  for (let upSteps = 1; upSteps <= 95; upSteps++) {
    for (const seed of [1, 7, 2026]) {
      const { up } = generateGridPattern(upSteps / 4, seed)
      expect(up.filter(Boolean)).toHaveLength(upSteps)
      expect(outageBlocks(up)).toBe(Math.min(3, upSteps, 96 - upSteps))
    }
  }
})

test('grid pattern with the smallest up and down counts still has one block of each', () => {
  const oneUp = generateGridPattern(0.25, 2026).up
  expect(oneUp.filter(Boolean)).toHaveLength(1)
  expect(longestOutageHours({ up: oneUp })).toBe(23.75)
  const oneDown = generateGridPattern(23.75, 2026).up
  expect(oneDown.filter((v) => !v)).toHaveLength(1)
  expect(longestOutageHours({ up: oneDown })).toBe(0.25)
})

test('longest outage picks the longest of several blocks', () => {
  const up = Array(96).fill(true)
  for (let s = 10; s < 14; s++) up[s] = false // 1 h
  for (let s = 40; s < 52; s++) up[s] = false // 3 h
  expect(longestOutageHours({ up })).toBe(3)
})
