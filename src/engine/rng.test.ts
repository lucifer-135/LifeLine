import { expect, test } from 'vitest'
import { DEMO_SEED } from './constants'
import { mulberry32 } from './rng'

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(2026),
    b = mulberry32(2026)
  const xs = Array.from({ length: 1000 }, a)
  expect(xs).toEqual(Array.from({ length: 1000 }, b))
  expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  expect(mulberry32(1)()).not.toBe(mulberry32(2)())
})

test('the demo seed always produces the same first draws', () => {
  // Pins the generator: the demo must replay identically on every machine.
  // Values from the reference mulberry32 (bryc), seed 2026.
  const next = mulberry32(DEMO_SEED)
  expect([next(), next(), next()]).toEqual([
    0.45540769933722913, 0.30849614599719644, 0.6611574492417276,
  ])
})
