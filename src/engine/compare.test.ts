import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { runComparison } from './compare'
import { DEMO_SEED, GENERATOR_POWER_FACTOR, STEPS_PER_DAY } from './constants'
import { generateGridPattern } from './grid'
import { buildLoadProfile } from './loads'
import { sizeSystem } from './sizing'
import type { GridPattern, HospitalProfile, TwinStep } from './types'

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

const kano = presetById('kano-50')
const typicalInput = {
  profile: kano,
  costs: DEFAULT_COSTS,
  seed: DEMO_SEED,
  season: 'typical',
} as const

function outageStarts(grid: GridPattern): number {
  return grid.up.filter((up, s) => !up && grid.up[(s + STEPS_PER_DAY - 1) % STEPS_PER_DAY]).length
}

const sumPv = (steps: TwinStep[]): number => steps.reduce((total, s) => total + s.pvKw, 0)

// --- brief tests ---

test('baseline: T1 dark at least 15 min per outage start', () => {
  const c = runComparison({
    profile: kano,
    costs: DEFAULT_COSTS,
    seed: DEMO_SEED,
    season: 'typical',
  })
  expect(c.baseline.metrics.t1MinutesUnpowered).toBeGreaterThanOrEqual(15)
  expect(c.lifeline.metrics.t1MinutesUnpowered).toBe(0)
})

test('baseline uses more diesel than lifeline for kano-50', () => {
  const c = runComparison(typicalInput)
  expect(c.baseline.metrics.dieselLitres).toBeGreaterThan(c.lifeline.metrics.dieselLitres)
})

test('no generator: baseline T1 dark for whole outage', () => {
  const p = { ...kano, generatorKva: 0 }
  const c = runComparison({ profile: p, costs: DEFAULT_COSTS, seed: DEMO_SEED, season: 'typical' })
  const downSteps = c.grid.up.filter((u) => !u).length
  expect(c.baseline.metrics.t1MinutesUnpowered).toBe(downSteps * 15)
})

test('zero diesel does not crash lifeline', () =>
  expect(() =>
    runComparison({
      profile: { ...kano, dieselLitresPerMonth: 0 },
      costs: DEFAULT_COSTS,
      seed: 1,
      season: 'worst',
    }),
  ).not.toThrow())

test('worst season uses lower psh → less PV energy', () => {
  const typical = runComparison(typicalInput)
  const worst = runComparison({ ...typicalInput, season: 'worst' })
  expect(sumPv(worst.lifeline.steps)).toBeLessThan(sumPv(typical.lifeline.steps))
})

test('baseline energy balance holds', () => {
  const c = runComparison(typicalInput)
  c.baseline.steps.forEach((s) =>
    expect(s.gridKw + s.pvKw + s.dischargeKw + s.dieselKw).toBeCloseTo(
      s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3 + s.chargeKw + s.curtailedKw,
      9,
    ),
  )
})

// --- remaining behaviour ---

test('baseline T1 dark at least 15 min for every outage start', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const c = runComparison({ ...typicalInput, seed })
    expect(c.baseline.metrics.t1MinutesUnpowered).toBeGreaterThanOrEqual(
      outageStarts(c.grid) * 15,
    )
  }
})

test('zero diesel: baseline T1 is dark for the whole outage, lifeline stays finite', () => {
  const c = runComparison({
    profile: { ...kano, dieselLitresPerMonth: 0 },
    costs: DEFAULT_COSTS,
    seed: 1,
    season: 'worst',
  })
  const downSteps = c.grid.up.filter((u) => !u).length
  expect(c.baseline.metrics.t1MinutesUnpowered).toBe(downSteps * 15)
  expect(c.baseline.metrics.dieselLitres).toBe(0)
  Object.values(c.lifeline.metrics).forEach((v) => expect(Number.isFinite(v)).toBe(true))
})

test('inputs follow the brief: load, grid, size and site match the profile', () => {
  const c = runComparison(typicalInput)
  const load = buildLoadProfile(kano.equipment)
  const grid = generateGridPattern(kano.gridHoursPerDay, DEMO_SEED)
  expect(c.load).toEqual(load)
  expect(c.grid).toEqual(grid)
  expect(c.site).toBe(SOLAR_SITES.Kano)
  expect(c.size).toEqual(sizeSystem(load, grid, kano.gridHoursPerDay, SOLAR_SITES.Kano))
  expect(c.baseline.scenario).toBe('baseline')
  expect(c.lifeline.scenario).toBe('lifeline')
})

test('both scenarios run on the same grid and load', () => {
  const c = runComparison(typicalInput)
  c.baseline.steps.forEach((s, i) => {
    expect(s.gridUp).toBe(c.lifeline.steps[i].gridUp)
    expect(s.loadKw).toEqual(c.lifeline.steps[i].loadKw)
  })
})

test('generator output is kVA times the power factor', () => {
  const c = runComparison(typicalInput)
  const limitKw = kano.generatorKva * GENERATOR_POWER_FACTOR
  const peakDieselKw = Math.max(...c.baseline.steps.map((s) => s.dieselKw))
  expect(peakDieselKw).toBeGreaterThan(0)
  expect(peakDieselKw).toBeLessThanOrEqual(limitKw + 1e-9)
})

test('daily fuel is a thirtieth of the monthly litres', () => {
  const c = runComparison(typicalInput)
  expect(c.baseline.metrics.dieselLitres).toBeLessThanOrEqual(kano.dieselLitresPerMonth / 30 + 1e-9)
  expect(c.lifeline.metrics.dieselLitres).toBeLessThanOrEqual(kano.dieselLitresPerMonth / 30 + 1e-9)
})

test('runComparison is deterministic', () =>
  expect(runComparison(typicalInput)).toEqual(runComparison(typicalInput)))
