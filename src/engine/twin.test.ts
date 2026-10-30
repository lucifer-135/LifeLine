import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { generateGridPattern } from './grid'
import { buildLoadProfile } from './loads'
import { sizeSystem } from './sizing'
import { computeMetrics, runTwin, type TwinInput } from './twin'
import type { HospitalProfile, LoadProfile, TierKw, TwinResult, TwinStep } from './types'

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

const kano = presetById('kano-50')

// --- brief tests ---

const kanoLoad = buildLoadProfile(kano.equipment)
const mk = (seed: number, over: Partial<TwinInput> = {}): TwinResult => {
  const grid = generateGridPattern(kano.gridHoursPerDay, seed)
  const size = sizeSystem(kanoLoad, grid, kano.gridHoursPerDay, SOLAR_SITES.Kano)
  return runTwin({
    scenario: 'lifeline',
    load: kanoLoad,
    grid,
    size,
    psh: SOLAR_SITES.Kano.pshAnnual,
    generatorKw: kano.generatorKva * 0.8,
    fuelLitresPerDay: kano.dieselLitresPerMonth / 30,
    costs: DEFAULT_COSTS,
    ...over,
  })
}

test('returns 96 steps, deterministic', () => {
  expect(mk(2026).steps).toHaveLength(96)
  expect(mk(2026)).toEqual(mk(2026))
})

test('energy balance every step', () =>
  mk(2026).steps.forEach((s) =>
    expect(s.gridKw + s.pvKw + s.dischargeKw + s.dieselKw).toBeCloseTo(
      s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3 + s.chargeKw + s.curtailedKw,
      9,
    ),
  ))

test('soc within [0,1]', () =>
  mk(2026).steps.forEach((s) => {
    expect(s.soc).toBeGreaterThanOrEqual(0)
    expect(s.soc).toBeLessThanOrEqual(1)
  }))

test('T1 only unserved when every source is exhausted', () => {
  for (let seed = 1; seed <= 50; seed++)
    mk(seed, {
      size: { pvKwp: 5, batteryKwh: 10, inverterKw: 8 },
      fuelLitresPerDay: 5,
    }).steps.forEach((s) => {
      if (s.servedKw.T1 < s.loadKw.T1 - 1e-9) {
        expect(s.gridUp).toBe(false)
        expect(s.soc).toBeLessThan(1e-9)
        expect(s.fuelLitresLeft < 1e-9 || s.dieselKw >= kano.generatorKva * 0.8 - 1e-9).toBe(true)
      }
    })
})

test('sized Lifeline keeps T1 powered for kano-50 across seeds', () => {
  for (let seed = 1; seed <= 20; seed++) expect(mk(seed).metrics.t1MinutesUnpowered).toBe(0)
})

test('all-up grid: no diesel, no shedding', () => {
  const r = mk(2026, { grid: { up: Array(96).fill(true) } })
  expect(r.metrics.dieselLitres).toBe(0)
  expect(r.steps.some((s) => s.shedT2 || s.shedT3)).toBe(false)
})

test('emits grid_lost event when outage starts', () =>
  expect(mk(2026).events.some((e) => e.kind === 'grid_lost')).toBe(true))

test('zero battery and zero generator does not crash', () =>
  expect(() =>
    mk(2026, { size: { pvKwp: 0, batteryKwh: 0, inverterKw: 0 }, generatorKw: 0 }),
  ).not.toThrow())

// --- hand-built scenario: 1 kW per tier, no PV, 5-hour evening outage ---

function flatLoad(kw: number): LoadProfile {
  const day = (): number[] => Array<number>(96).fill(kw)
  const dailyKwh = kw * 24
  return {
    kw: { T1: day(), T2: day(), T3: day() },
    dailyKwh: { T1: dailyKwh, T2: dailyKwh, T3: dailyKwh },
    peakKw: { T1: kw, T2: kw, T3: kw },
  }
}

// Steps 70-89 down. None of them is in the strong-PV window, so relief is the
// grid returning at step 90.
const eveningOutage = { up: Array.from({ length: 96 }, (_, s) => s < 70 || s >= 90) }

const handBuilt = (over: Partial<TwinInput> = {}): TwinResult =>
  runTwin({
    scenario: 'lifeline',
    load: flatLoad(1),
    grid: eveningOutage,
    size: { pvKwp: 0, batteryKwh: 12, inverterKw: 5 },
    psh: SOLAR_SITES.Kano.pshAnnual,
    generatorKw: 0,
    fuelLitresPerDay: 0,
    costs: DEFAULT_COSTS,
    ...over,
  })

test('sheds can-wait and essential when the battery cannot cover the outage, then restores', () => {
  // Full battery: avail = 0.8 x 12 x 0.949 = 9.11 kWh. need(all) = 15, need(T1+T2) = 10.
  // Each T1-only step costs 0.25 kWh of avail. T2 returns at step 80 (5 < 0.8 x 6.61);
  // after that each step costs 0.5 and T3 returns at step 87 (2.25 < 0.8 x 3.11).
  const r = handBuilt()
  expect(r.events.map((e) => [e.step, e.kind])).toEqual([
    [70, 'grid_lost'],
    [70, 'shed_t3'],
    [70, 'shed_t2'],
    [80, 'restore_t2'],
    [87, 'restore_t3'],
    [90, 'grid_restored'],
  ])
  expect(r.metrics.t1MinutesUnpowered).toBe(0)
  expect(r.metrics.t2MinutesUnpowered).toBe(10 * 15)
  expect(r.steps[75].servedKw).toEqual({ T1: 1, T2: 0, T3: 0 })
})

test('essential load stays on when battery plus diesel can carry it; can-wait pauses on battery alone', () => {
  // Battery avail 9.11 kWh < need(T1+T2) 10 kWh, but the generator can deliver
  // min(20 L / 0.3 L per kWh - 5 kWh life-critical still needs today, 10 kW x 5 h) = 50 kWh
  // before the grid returns, so essential load stays on. need(all) 15 kWh > 9.11 kWh of
  // battery, so can-wait load still pauses.
  // At 2 kW the battery reaches its reserve after 18 steps; diesel takes over at step 88.
  const r = handBuilt({ generatorKw: 10, fuelLitresPerDay: 20 })
  expect(r.events.map((e) => [e.step, e.kind])).toEqual([
    [70, 'grid_lost'],
    [70, 'shed_t3'],
    [88, 'diesel_on'],
    [90, 'grid_restored'],
    [90, 'restore_t3'],
    [90, 'diesel_off'],
  ])
  r.steps.slice(70, 90).forEach((s) => {
    expect(s.shedT2).toBe(false)
    expect(s.shedT3).toBe(true)
    expect(s.servedKw).toEqual({ T1: 1, T2: 1, T3: 0 })
  })
  expect(r.metrics.t1MinutesUnpowered).toBe(0)
  expect(r.metrics.t2MinutesUnpowered).toBe(0)
  expect(r.metrics.dieselLitres).toBeGreaterThan(0)
})

test('without a generator or without fuel, essential load pauses on battery alone', () => {
  const batteryOnly = handBuilt()
  const cases: Partial<TwinInput>[] = [
    { generatorKw: 0, fuelLitresPerDay: 20 },
    { generatorKw: 10, fuelLitresPerDay: 0 },
  ]
  for (const over of cases) {
    const r = handBuilt(over)
    expect(r.steps.map((s) => [s.shedT2, s.shedT3])).toEqual(
      batteryOnly.steps.map((s) => [s.shedT2, s.shedT3]),
    )
    expect(r.events).toEqual(batteryOnly.events)
    expect(r.metrics).toEqual(batteryOnly.metrics)
  }
})

test('diesel counts for essential load only if the generator alone could carry life-critical load', () => {
  const batteryOnly = handBuilt()
  const eventPairs = (r: TwinResult) => r.events.map((e) => [e.step, e.kind])
  const cases: [string, Partial<TwinInput>][] = [
    // 0.5 kW cannot carry the 1 kW life-critical load, so it would lean on the battery.
    ['generator below the life-critical load', { generatorKw: 0.5, fuelLitresPerDay: 20 }],
    // 1 L is 3.3 kWh, short of the 5 kWh life-critical load needs during the outage.
    ['a day of fuel below a day of life-critical load', { generatorKw: 10, fuelLitresPerDay: 1 }],
  ]
  for (const [name, over] of cases) {
    const r = handBuilt(over)
    expect(r.steps.map((s) => [s.shedT2, s.shedT3]), name).toEqual(
      batteryOnly.steps.map((s) => [s.shedT2, s.shedT3]),
    )
    expect(eventPairs(r), name).toEqual(eventPairs(batteryOnly))
    expect(r.metrics, name).toEqual(batteryOnly.metrics)
  }
})

function tieredLoad(kw: TierKw): LoadProfile {
  const day = (value: number): number[] => Array<number>(96).fill(value)
  return {
    kw: { T1: day(kw.T1), T2: day(kw.T2), T3: day(kw.T3) },
    dailyKwh: { T1: kw.T1 * 24, T2: kw.T2 * 24, T3: kw.T3 * 24 },
    peakKw: { ...kw },
  }
}

test('essential load pauses when even battery plus spare diesel cannot carry it', () => {
  // Fuel-limited: 1.65 L is 5.5 kWh, and life-critical load still needs 5 kWh today, so
  // only 0.5 kWh is spare: 9.11 + 0.5 = 9.61 kWh < 10 kWh and essential pauses. Each
  // life-critical-only step moves 0.25 kWh from battery to spare fuel, so the total stays
  // 9.61 kWh; essential returns at step 75 (7.5 < 0.8 x 9.61). The battery then lasts to
  // the end of the outage, so no diesel burns.
  const fuelLimited = handBuilt({ generatorKw: 10, fuelLitresPerDay: 1.65 })
  expect(fuelLimited.events.map((e) => [e.step, e.kind])).toEqual([
    [70, 'grid_lost'],
    [70, 'shed_t3'],
    [70, 'shed_t2'],
    [75, 'restore_t2'],
    [90, 'grid_restored'],
    [90, 'restore_t3'],
  ])
  expect(fuelLimited.metrics.t2MinutesUnpowered).toBe(5 * 15)
  expect(fuelLimited.metrics.dieselLitres).toBe(0)

  // Rating-limited: 0.2 kW life-critical, 3 kW essential, 1 kW can wait. A 1 kW generator
  // delivers at most 1 kW x 5 h = 5 kWh before the grid returns, however much fuel is
  // left: 9.11 + 5 = 14.11 kWh < need(T1+T2) 16 kWh, so essential pauses. Each paused step
  // costs 0.05 kWh of battery and 0.25 kWh of generator time, and essential returns at
  // step 79 (8.8 < 0.8 x (8.66 + 2.75)). The battery reaches its reserve at step 89.
  const ratingLimited = handBuilt({
    load: tieredLoad({ T1: 0.2, T2: 3, T3: 1 }),
    generatorKw: 1,
    fuelLitresPerDay: 20,
  })
  expect(ratingLimited.events.map((e) => [e.step, e.kind])).toEqual([
    [70, 'grid_lost'],
    [70, 'shed_t3'],
    [70, 'shed_t2'],
    [79, 'restore_t2'],
    [89, 'diesel_on'],
    [90, 'grid_restored'],
    [90, 'restore_t3'],
    [90, 'diesel_off'],
  ])
  expect(ratingLimited.metrics.t2MinutesUnpowered).toBe(9 * 15)
  for (const r of [fuelLimited, ratingLimited]) expect(r.metrics.t1MinutesUnpowered).toBe(0)
})

test('a battery big enough for the whole outage sheds nothing', () => {
  const r = handBuilt({ size: { pvKwp: 0, batteryKwh: 40, inverterKw: 5 } })
  expect(r.steps.some((s) => s.shedT2 || s.shedT3)).toBe(false)
  expect(r.metrics.t2MinutesUnpowered).toBe(0)
})

test('diesel runs only once the battery is down to its reserve', () => {
  // A small battery, so diesel must carry the end of the outage.
  const r = handBuilt({
    size: { pvKwp: 0, batteryKwh: 4, inverterKw: 5 },
    generatorKw: 10,
    fuelLitresPerDay: 20,
  })
  expect(r.metrics.dieselLitres).toBeGreaterThan(0)
  r.steps
    .filter((s) => s.dieselKw > 0)
    .forEach((s) => expect(s.soc).toBeLessThan(0.2 + 1e-9))
  expect(r.metrics.t1MinutesUnpowered).toBe(0)
})

test('diesel never charges the battery', () => {
  const r = mk(2026, { size: { pvKwp: 41, batteryKwh: 20, inverterKw: 12 } })
  expect(r.metrics.dieselLitres).toBeGreaterThan(0)
  r.steps.filter((s) => s.dieselKw > 0).forEach((s) => expect(s.chargeKw).toBe(0))
})

test('when fuel and battery run out, T1 goes dark and the events say so', () => {
  const r = handBuilt({
    size: { pvKwp: 0, batteryKwh: 4, inverterKw: 5 },
    generatorKw: 10,
    fuelLitresPerDay: 0.2,
  })
  r.steps.forEach((s) => expect(s.fuelLitresLeft).toBeGreaterThanOrEqual(0))
  const kinds = r.events.map((e) => e.kind)
  expect(kinds.filter((k) => k === 'fuel_out')).toHaveLength(1)
  expect(kinds.indexOf('t1_unpowered')).toBeGreaterThan(kinds.indexOf('fuel_out'))
  // Same-step events come out in TwinEventKind order.
  expect(r.events.filter((e) => e.step === 90).map((e) => e.kind)).toEqual([
    'grid_restored',
    'restore_t2',
    'restore_t3',
    't1_restored',
  ])
  expect(r.metrics.t1MinutesUnpowered).toBeGreaterThan(0)
})

test('battery power stays within the inverter rating both ways', () => {
  const inverterKw = 3
  const r = mk(2026, {
    size: { pvKwp: 41, batteryKwh: 85, inverterKw },
    fuelLitresPerDay: 0,
  })
  r.steps.forEach((s) => {
    expect(s.chargeKw).toBeLessThanOrEqual(inverterKw + 1e-9)
    expect(s.dischargeKw).toBeLessThanOrEqual(inverterKw + 1e-9)
  })
})

test('runway is Infinity on grid and finite during an outage', () => {
  mk(2026).steps.forEach((s) => {
    if (s.gridUp) expect(s.t1RunwayMin).toBe(Infinity)
    else expect(Number.isFinite(s.t1RunwayMin)).toBe(true)
  })
})

function numbersIn(step: TwinStep): number[] {
  return [
    step.pvKw,
    step.pvUsedKw,
    step.curtailedKw,
    step.gridKw,
    step.chargeKw,
    step.dischargeKw,
    step.dieselKw,
    step.soc,
    step.fuelLitresLeft,
    ...Object.values(step.loadKw),
    ...Object.values(step.servedKw),
  ]
}

test('no NaN with no battery, no generator, no fuel or an all-down grid', () => {
  const cases: Partial<TwinInput>[] = [
    { size: { pvKwp: 0, batteryKwh: 0, inverterKw: 0 }, generatorKw: 0 },
    { size: { pvKwp: 41, batteryKwh: 0, inverterKw: 12 }, fuelLitresPerDay: 0 },
    { generatorKw: 0 },
    { fuelLitresPerDay: 0 },
    { costs: { ...DEFAULT_COSTS, dieselLitresPerKwh: 0 } },
    { grid: { up: Array<boolean>(96).fill(false) } },
  ]
  for (const over of cases) {
    const r = mk(2026, over)
    r.steps.forEach((s) => {
      numbersIn(s).forEach((v) => expect(Number.isFinite(v)).toBe(true))
      expect(Number.isNaN(s.t1RunwayMin)).toBe(false)
    })
    r.events.forEach((e) => expect(Number.isNaN(e.t1RunwayMin)).toBe(false))
    Object.values(r.metrics).forEach((v) => expect(Number.isFinite(v)).toBe(true))
  }
})

test('energy balance holds in every edge case', () => {
  const cases: Partial<TwinInput>[] = [
    { size: { pvKwp: 5, batteryKwh: 10, inverterKw: 8 }, fuelLitresPerDay: 5 },
    { size: { pvKwp: 0, batteryKwh: 0, inverterKw: 0 }, generatorKw: 0 },
    { grid: { up: Array<boolean>(96).fill(false) } },
    { grid: { up: Array<boolean>(96).fill(true) } },
  ]
  for (const over of cases) {
    mk(2026, over).steps.forEach((s) =>
      expect(s.gridKw + s.pvKw + s.dischargeKw + s.dieselKw).toBeCloseTo(
        s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3 + s.chargeKw + s.curtailedKw,
        9,
      ),
    )
  }
})

test('computeMetrics prices grid and diesel energy', () => {
  const r = mk(2026)
  const m = computeMetrics(r.steps, DEFAULT_COSTS)
  expect(m).toEqual(r.metrics)
  expect(m.energyCostNgn).toBeCloseTo(
    m.gridKwh * DEFAULT_COSTS.gridNgnPerKwh + m.dieselLitres * DEFAULT_COSTS.dieselNgnPerLitre,
    6,
  )
  expect(m.co2Kg).toBeCloseTo(
    m.dieselLitres * DEFAULT_COSTS.co2KgPerLitreDiesel +
      m.gridKwh * DEFAULT_COSTS.gridCo2KgPerKwh,
    6,
  )
})
