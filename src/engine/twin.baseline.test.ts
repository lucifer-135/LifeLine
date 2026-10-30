import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { runComparison } from './compare'
import { DEMO_SEED } from './constants'
import { runTwin, type TwinInput } from './twin'
import type { GridPattern, HospitalProfile, LoadProfile, TwinResult, TwinStep } from './types'

const LITRES_PER_KWH = DEFAULT_COSTS.dieselLitresPerKwh

// --- hand-built scenario: 1 kW per tier, so 3 kW of demand ---

function flatLoad(kw: number): LoadProfile {
  const day = (): number[] => Array<number>(96).fill(kw)
  const dailyKwh = kw * 24
  return {
    kw: { T1: day(), T2: day(), T3: day() },
    dailyKwh: { T1: dailyKwh, T2: dailyKwh, T3: dailyKwh },
    peakKw: { T1: kw, T2: kw, T3: kw },
  }
}

// Down for steps `from` up to (not including) `to`.
const gridDownBetween = (from: number, to: number): GridPattern => ({
  up: Array.from({ length: 96 }, (_, s) => s < from || s >= to),
})

// Steps 70-89 down.
const eveningOutage = gridDownBetween(70, 90)

const baseline = (over: Partial<TwinInput> = {}): TwinResult =>
  runTwin({
    scenario: 'baseline',
    load: flatLoad(1),
    grid: eveningOutage,
    size: { pvKwp: 0, batteryKwh: 0, inverterKw: 0 },
    psh: SOLAR_SITES.Kano.pshAnnual,
    generatorKw: 10,
    fuelLitresPerDay: 100,
    costs: DEFAULT_COSTS,
    ...over,
  })

const eventPairs = (r: TwinResult): [number, string][] => r.events.map((e) => [e.step, e.kind])

test('the first outage step is dark: manual generator start gap', () => {
  const r = baseline()
  expect(r.steps[70].gridUp).toBe(false)
  expect(r.steps[70].servedKw).toEqual({ T1: 0, T2: 0, T3: 0 })
  expect(r.steps[70].dieselKw).toBe(0)
  expect(r.steps[70].gridKw).toBe(0)
  expect(r.steps[71].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(r.steps[71].dieselKw).toBe(3)
  expect(r.steps[89].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
})

test('the grid serves every tier while it is up', () => {
  const r = baseline()
  const up = r.steps.filter((s) => s.gridUp)
  expect(up).toHaveLength(76)
  up.forEach((s) => {
    expect(s.servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
    expect(s.gridKw).toBe(3)
    expect(s.dieselKw).toBe(0)
  })
  expect(r.metrics.gridKwh).toBeCloseTo(76 * 3 * 0.25, 9)
})

test('events for one outage: start gap, generator on, grid back', () => {
  const r = baseline()
  expect(eventPairs(r)).toEqual([
    [70, 'grid_lost'],
    [70, 't1_unpowered'],
    [71, 'diesel_on'],
    [71, 't1_restored'],
    [90, 'grid_restored'],
    [90, 'diesel_off'],
  ])
  expect(r.metrics.t1MinutesUnpowered).toBe(15)
  expect(r.metrics.t2MinutesUnpowered).toBe(15)
  expect(r.metrics.dieselLitres).toBeCloseTo(19 * 3 * 0.25 * LITRES_PER_KWH, 9)
})

test('the generator serves life-critical first, then essential, then can-wait', () => {
  const t2Cut = baseline({ generatorKw: 2 })
  expect(t2Cut.steps[75].servedKw).toEqual({ T1: 1, T2: 1, T3: 0 })
  expect(t2Cut.steps[75].dieselKw).toBe(2)

  const halfT2 = baseline({ generatorKw: 1.5 })
  expect(halfT2.steps[75].servedKw).toEqual({ T1: 1, T2: 0.5, T3: 0 })

  const t1Short = baseline({ generatorKw: 0.5 })
  expect(t1Short.steps[75].servedKw).toEqual({ T1: 0.5, T2: 0, T3: 0 })
  expect(t1Short.metrics.t1MinutesUnpowered).toBe(20 * 15)
  expect(eventPairs(t1Short)).toEqual([
    [70, 'grid_lost'],
    [70, 't1_unpowered'],
    [71, 'diesel_on'],
    [90, 'grid_restored'],
    [90, 'diesel_off'],
    [90, 't1_restored'],
  ])
})

test('no generator: dark for the whole outage', () => {
  const r = baseline({ generatorKw: 0 })
  expect(r.metrics.t1MinutesUnpowered).toBe(20 * 15)
  expect(r.metrics.dieselLitres).toBe(0)
  expect(eventPairs(r)).toEqual([
    [70, 'grid_lost'],
    [70, 't1_unpowered'],
    [90, 'grid_restored'],
    [90, 't1_restored'],
  ])
})

test('when the fuel runs out, nothing is served and fuel_out fires', () => {
  // 3.375 times one kWh of fuel: four full steps at 3 kW, then half a step at 1.5 kW.
  const fuelLitresPerDay = 3.375 * LITRES_PER_KWH
  const r = baseline({ fuelLitresPerDay })
  expect(r.steps[74].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(r.steps[75].dieselKw).toBeCloseTo(1.5, 9)
  expect(r.steps[75].servedKw.T1).toBe(1)
  expect(r.steps[75].servedKw.T2).toBeCloseTo(0.5, 9)
  expect(r.steps[75].servedKw.T3).toBe(0)
  for (let s = 76; s < 90; s++) {
    expect(r.steps[s].servedKw).toEqual({ T1: expect.closeTo(0, 9), T2: 0, T3: 0 })
    expect(r.steps[s].fuelLitresLeft).toBeGreaterThanOrEqual(0)
  }
  expect(eventPairs(r)).toEqual([
    [70, 'grid_lost'],
    [70, 't1_unpowered'],
    [71, 'diesel_on'],
    [71, 't1_restored'],
    [75, 'fuel_out'],
    [76, 'diesel_off'],
    [76, 't1_unpowered'],
    [90, 'grid_restored'],
    [90, 't1_restored'],
  ])
  expect(r.metrics.dieselLitres).toBeCloseTo(fuelLitresPerDay, 9)
  expect(r.metrics.t1MinutesUnpowered).toBe((1 + 14) * 15)
})

test('an all-down day has no start gap: the generator is already running', () => {
  const r = baseline({ grid: { up: Array<boolean>(96).fill(false) }, fuelLitresPerDay: 1000 })
  r.steps.forEach((s) => {
    expect(s.servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
    expect(s.dieselKw).toBe(3)
    expect(s.gridKw).toBe(0)
  })
  expect(r.events).toEqual([])
  expect(r.metrics.t1MinutesUnpowered).toBe(0)
})

test('an all-up day uses no diesel and has no events', () => {
  const r = baseline({ grid: { up: Array<boolean>(96).fill(true) } })
  expect(r.metrics.dieselLitres).toBe(0)
  expect(r.metrics.t1MinutesUnpowered).toBe(0)
  expect(r.events).toEqual([])
})

test('an outage that begins at step 0 has its start gap there', () => {
  const r = baseline({ grid: gridDownBetween(0, 20) })
  expect(r.steps[0].servedKw).toEqual({ T1: 0, T2: 0, T3: 0 })
  expect(r.steps[1].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(eventPairs(r)).toEqual([
    [0, 'grid_lost'],
    [0, 't1_unpowered'],
    [1, 'diesel_on'],
    [1, 't1_restored'],
    [20, 'grid_restored'],
    [20, 'diesel_off'],
  ])
})

test('an outage that crosses midnight has one start gap, at its first step', () => {
  // Down for steps 90-95 and 0-9: the generator is already running at step 0.
  const r = baseline({ grid: { up: Array.from({ length: 96 }, (_, s) => s >= 10 && s < 90) } })
  expect(r.steps[90].servedKw).toEqual({ T1: 0, T2: 0, T3: 0 })
  expect(r.steps[91].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(r.steps[95].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(r.steps[0].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(r.steps[9].servedKw).toEqual({ T1: 1, T2: 1, T3: 1 })
  expect(eventPairs(r)).toEqual([
    [10, 'grid_restored'],
    [10, 'diesel_off'],
    [90, 'grid_lost'],
    [90, 't1_unpowered'],
    [91, 'diesel_on'],
    [91, 't1_restored'],
  ])
  expect(r.metrics.t1MinutesUnpowered).toBe(15)
})

test('a zero fuel rate runs the generator free, capped at its rating', () => {
  const r = baseline({
    generatorKw: 2,
    fuelLitresPerDay: 0,
    costs: { ...DEFAULT_COSTS, dieselLitresPerKwh: 0 },
  })
  expect(r.steps[75].servedKw).toEqual({ T1: 1, T2: 1, T3: 0 })
  expect(r.steps[75].dieselKw).toBe(2)
  expect(r.metrics.dieselLitres).toBe(0)
  Object.values(r.metrics).forEach((v) => expect(Number.isFinite(v)).toBe(true))
})

test('baseline has no PV and no battery, whatever the system size', () => {
  const sized = baseline({ size: { pvKwp: 100, batteryKwh: 200, inverterKw: 50 } })
  sized.steps.forEach((s) => {
    expect(s.pvKw).toBe(0)
    expect(s.pvUsedKw).toBe(0)
    expect(s.curtailedKw).toBe(0)
    expect(s.chargeKw).toBe(0)
    expect(s.dischargeKw).toBe(0)
    expect(s.soc).toBe(0)
  })
  expect(sized).toEqual(baseline())
})

test('runway counts fuel only, and only if there is a generator', () => {
  const r = baseline()
  r.steps.forEach((s) => {
    if (s.gridUp) expect(s.t1RunwayMin).toBe(Infinity)
    else expect(s.t1RunwayMin).toBeCloseTo((s.fuelLitresLeft / LITRES_PER_KWH / 1) * 60, 6)
  })
  const noGenerator = baseline({ generatorKw: 0 })
  noGenerator.steps.filter((s) => !s.gridUp).forEach((s) => expect(s.t1RunwayMin).toBe(0))
})

test('baseline energy balance holds in every edge case', () => {
  const cases: Partial<TwinInput>[] = [
    {},
    { generatorKw: 0 },
    { generatorKw: 1.5 },
    { fuelLitresPerDay: 3.375 * LITRES_PER_KWH },
    { fuelLitresPerDay: 0 },
    { costs: { ...DEFAULT_COSTS, dieselLitresPerKwh: 0 } },
    { grid: { up: Array<boolean>(96).fill(false) } },
    { grid: { up: Array<boolean>(96).fill(true) } },
  ]
  for (const over of cases) {
    baseline(over).steps.forEach((s: TwinStep) => {
      expect(s.gridKw + s.pvKw + s.dischargeKw + s.dieselKw).toBeCloseTo(
        s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3 + s.chargeKw + s.curtailedKw,
        9,
      )
      Object.values(s.servedKw).forEach((v) => expect(Number.isFinite(v)).toBe(true))
      expect(Number.isNaN(s.t1RunwayMin)).toBe(false)
    })
  }
})

// --- kano-50 across seeds ---

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

const kano = presetById('kano-50')

test('baseline never sheds: the shed flags stay false and no shed events fire', () => {
  const shedKinds = ['shed_t3', 'shed_t2', 'restore_t3', 'restore_t2']
  for (let seed = 1; seed <= 20; seed++) {
    for (const season of ['typical', 'worst'] as const) {
      const { baseline: b } = runComparison({ profile: kano, costs: DEFAULT_COSTS, seed, season })
      expect(b.steps.some((s) => s.shedT2 || s.shedT3)).toBe(false)
      expect(b.events.some((e) => shedKinds.includes(e.kind))).toBe(false)
    }
  }
})

test('baseline serves strictly in priority order on kano-50', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { baseline: b } = runComparison({
      profile: kano,
      costs: DEFAULT_COSTS,
      seed,
      season: 'typical',
    })
    b.steps.forEach((s) => {
      if (s.servedKw.T2 > 1e-9) expect(s.servedKw.T1).toBeCloseTo(s.loadKw.T1, 9)
      if (s.servedKw.T3 > 1e-9) expect(s.servedKw.T2).toBeCloseTo(s.loadKw.T2, 9)
    })
  }
})

test('baseline is deterministic for the demo seed', () => {
  const run = () =>
    runComparison({ profile: kano, costs: DEFAULT_COSTS, seed: DEMO_SEED, season: 'typical' })
  expect(run().baseline).toEqual(run().baseline)
})
