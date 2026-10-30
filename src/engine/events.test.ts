import { expect, test } from 'vitest'
import { formatEvent, stepToClock } from './events'
import type { TwinEvent, TwinEventKind } from './types'

test('stepToClock', () => {
  expect(stepToClock(0)).toBe('00:00')
  expect(stepToClock(1)).toBe('00:15')
  expect(stepToClock(58)).toBe('14:30')
  expect(stepToClock(95)).toBe('23:45')
})

test('formatEvent grid_lost', () =>
  expect(formatEvent({ step: 0, kind: 'grid_lost', t1RunwayMin: 680 })).toBe(
    'Grid lost. ICU covered for 11h 20m.',
  ))

test('formatEvent grid_lost shows a dash when the runway is not finite', () => {
  expect(formatEvent({ step: 0, kind: 'grid_lost', t1RunwayMin: Infinity })).toBe(
    'Grid lost. ICU covered for —.',
  )
  expect(formatEvent({ step: 0, kind: 'grid_lost', t1RunwayMin: Number.NaN })).toBe(
    'Grid lost. ICU covered for —.',
  )
})

test('formatEvent gives the exact copy for every kind', () => {
  const copy: Record<TwinEventKind, string> = {
    grid_lost: 'Grid lost. ICU covered for 45m.',
    grid_restored: 'Grid power is back.',
    shed_t3: 'Paused loads that can wait (fans, office AC).',
    shed_t2: 'Paused essential loads to protect life-critical care.',
    restore_t3: 'Loads that can wait are back on.',
    restore_t2: 'Essential loads are back on.',
    diesel_on: 'Generator started.',
    diesel_off: 'Generator stopped.',
    fuel_out: 'Diesel ran out.',
    t1_unpowered: 'Life-critical equipment has no power.',
    t1_restored: 'Life-critical power restored.',
  }
  for (const kind of Object.keys(copy) as TwinEventKind[]) {
    const event: TwinEvent = { step: 10, kind, t1RunwayMin: 45 }
    expect(formatEvent(event)).toBe(copy[kind])
  }
})

test('formatEvent never shows internal tier names', () => {
  const kinds: TwinEventKind[] = ['shed_t3', 'shed_t2', 'restore_t3', 'restore_t2', 't1_unpowered']
  for (const kind of kinds) {
    expect(formatEvent({ step: 0, kind, t1RunwayMin: 60 })).not.toMatch(/\bT[123]\b/)
  }
})
