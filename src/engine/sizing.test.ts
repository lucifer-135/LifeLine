import { expect, test } from 'vitest'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { generateGridPattern } from './grid'
import { buildLoadProfile } from './loads'
import { ceilTo1, ceilTo5, sizeSystem } from './sizing'
import type { Equipment } from './types'

function item(changes: Partial<Equipment>): Equipment {
  return {
    id: 'x',
    name: 'x',
    ward: 'ICU',
    ratedW: 1000,
    dutyCycle: 1,
    scheduleMask: Array<boolean>(24).fill(true),
    tier: 'T1',
    qty: 1,
    ...changes,
  }
}

const flat1kw = buildLoadProfile([item({})])
const twelveHourOutage = { up: Array.from({ length: 96 }, (_, s) => s < 48) }

test('1 kW flat T1, 12h outage, Kano', () => {
  expect(sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Kano)).toEqual({
    batteryKwh: 20,
    pvKwp: 4,
    inverterKw: 2,
  })
  // night 12h -> 12 kWh / 0.72 = 16.67 -> 20 ; pv 24*0.5/0.9/(5.50*0.75) = 3.23 -> 4 ; inv 1.25 -> 2
})

test('24h grid needs no battery or PV', () =>
  expect(
    sizeSystem(flat1kw, { up: Array<boolean>(96).fill(true) }, 24, SOLAR_SITES.Kano),
  ).toMatchObject({ batteryKwh: 0, pvKwp: 0 }))

test('southern state needs more PV than Kano', () => {
  const k = sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Kano).pvKwp
  const r = sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Rivers).pvKwp
  expect(r).toBeGreaterThan(k)
})

test('T3 does not affect sizing', () => {
  const withT3 = buildLoadProfile([item({}), item({ id: 'y', ratedW: 5000, tier: 'T3' })])
  expect(sizeSystem(withT3, twelveHourOutage, 12, SOLAR_SITES.Kano)).toEqual(
    sizeSystem(flat1kw, twelveHourOutage, 12, SOLAR_SITES.Kano),
  )
})

test('grid hours 0 (never up) still gives finite sizes and a battery', () => {
  const size = sizeSystem(flat1kw, { up: Array<boolean>(96).fill(false) }, 0, SOLAR_SITES.Kano)
  expect(Object.values(size).every(Number.isFinite)).toBe(true)
  expect(size.batteryKwh).toBeGreaterThan(0)
  expect(size.pvKwp).toBeGreaterThan(0)
})

test('a short outage sizes the battery for the outage, not the whole night', () => {
  // 3h outage: 12 kWh night * (3 / 12) = 3 kWh / 0.72 = 4.17 -> 5
  const threeHourOutage = { up: Array.from({ length: 96 }, (_, s) => s >= 12) }
  expect(sizeSystem(flat1kw, threeHourOutage, 21, SOLAR_SITES.Kano).batteryKwh).toBe(5)
})

test('kano-50 preset sizes to finite, positive values', () => {
  const kano = PRESETS.find((p) => p.id === 'kano-50')
  if (!kano) throw new Error('Missing preset kano-50')
  const load = buildLoadProfile(kano.equipment)
  const grid = generateGridPattern(kano.gridHoursPerDay, 2026)
  const size = sizeSystem(load, grid, kano.gridHoursPerDay, SOLAR_SITES.Kano)
  for (const value of Object.values(size)) {
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThan(0)
  }
})

test('ceil helpers round up to the step', () => {
  expect(ceilTo1(3.2)).toBe(4)
  expect(ceilTo5(16.67)).toBe(20)
  expect(ceilTo5(20.1)).toBe(25)
})

test('ceil helpers ignore float noise on exact multiples', () => {
  expect(ceilTo1(24.000000000000004)).toBe(24)
  expect(ceilTo5(20.000000000000004)).toBe(20)
  expect(ceilTo1(0.1 + 0.2 + 0.7)).toBe(1)
})

test('ceil helpers return 0 for zero, negative and non-finite input', () => {
  for (const bad of [0, -0, -3, 1e-12, NaN, Infinity, -Infinity]) {
    expect(ceilTo1(bad)).toBe(0)
    expect(ceilTo5(bad)).toBe(0)
  }
})
