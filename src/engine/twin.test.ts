import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { generateGridPattern } from './grid'
import { buildLoadProfile } from './loads'
import { sizeSystem } from './sizing'
import { computeMetrics, runTwin, type TwinInput } from './twin'
import type { HospitalProfile, LoadProfile, TwinResult, TwinStep } from './types'

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
