import { expect, test } from 'vitest'
import { PV_PERFORMANCE_RATIO } from './constants'
import { pvOutputKw, solarShape } from './solar'

test('solar shape integrates to 1 and is zero at night', () => {
  const sum = Array.from({ length: 96 }, (_, s) => solarShape(s) * 0.25).reduce((a, b) => a + b)
  expect(sum).toBeCloseTo(1, 2)
  expect(solarShape(0)).toBe(0)
  expect(solarShape(95)).toBe(0)
  expect(solarShape(50)).toBeGreaterThan(0)
})

test('solar shape is zero outside 06:30-18:30 and peaks at solar noon', () => {
  expect(solarShape(25)).toBe(0) // 06:15-06:30, before sunrise
  expect(solarShape(26)).toBeGreaterThan(0) // 06:30-06:45
  expect(solarShape(73)).toBeGreaterThan(0) // 18:15-18:30
  expect(solarShape(74)).toBe(0) // after sunset
  const peak = Math.max(...Array.from({ length: 96 }, (_, s) => solarShape(s)))
  // Steps 49 (12:15-12:30) and 50 (12:30-12:45) sit either side of the 12:30 solar noon.
  expect(solarShape(49)).toBeCloseTo(peak, 10)
  expect(solarShape(50)).toBeCloseTo(peak, 10)
})

test('pvOutputKw at a sunny step is kWp x PSH x performance ratio x shape', () => {
  expect(pvOutputKw(100, 5, 50)).toBeCloseTo(100 * 5 * PV_PERFORMANCE_RATIO * solarShape(50), 10)
  expect(pvOutputKw(100, 5, 0)).toBe(0)
})

test('daily PV energy equals kWp x PSH x performance ratio', () => {
  const kwh = Array.from({ length: 96 }, (_, s) => pvOutputKw(80, 5.2, s) * 0.25).reduce(
    (a, b) => a + b,
  )
  expect(kwh).toBeCloseTo(80 * 5.2 * PV_PERFORMANCE_RATIO, 0)
})
