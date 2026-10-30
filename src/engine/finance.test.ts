import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { runComparison } from './compare'
import { DEMO_SEED } from './constants'
import { computeFinance, irr } from './finance'
import type { CostAssumptions, FinanceResult, SystemSize, TwinMetrics } from './types'

const metrics = (cost: number, co2Kg = 0): TwinMetrics => ({
  t1MinutesUnpowered: 0,
  t2MinutesUnpowered: 0,
  dieselLitres: 0,
  gridKwh: 0,
  energyCostNgn: cost,
  co2Kg,
})

// The hand-computed case from the brief. Every figure below can be re-derived on paper.
const handCosts: CostAssumptions = {
  ...DEFAULT_COSTS,
  pvNgnPerKwp: 100_000,
  batteryNgnPerKwh: 50_000,
  inverterNgnPerKw: 20_000,
  bosFraction: 0.1,
  omFractionPerYear: 0.02,
  generatorMaintNgnPerYear: 1_000_000,
  feeFraction: 0.8,
  contractYears: 10,
}
const handSize: SystemSize = { pvKwp: 10, batteryKwh: 20, inverterKw: 5 }
const zeroSize: SystemSize = { pvKwp: 0, batteryKwh: 0, inverterKw: 0 }

function expectFiniteOrNull(f: FinanceResult): void {
  for (const [key, value] of Object.entries(f)) {
    const ok = value === null || Number.isFinite(value)
    expect(ok, `${key} = ${String(value)}`).toBe(true)
  }
}

// --- irr ---

test('irr of -1000 then 10×200 ≈ 15.10%', () =>
  expect(irr([-1000, ...Array(10).fill(200)])!).toBeCloseTo(0.151, 3))

test('irr null without sign change', () => expect(irr([100, 100])).toBeNull())

test('irr: a single payment, all-negative or all-zero flows have no rate', () => {
  expect(irr([-1000])).toBeNull()
  expect(irr([-1000, -50, -50])).toBeNull()
  expect(irr([0, 0, 0])).toBeNull()
})

test('irr: empty cashflows give null', () => expect(irr([])).toBeNull())

test('irr: any non-finite cashflow gives null', () => {
  expect(irr([-1000, Number.NaN, 500])).toBeNull()
  expect(irr([-1000, Infinity])).toBeNull()
  expect(irr([-1000, 500, -Infinity])).toBeNull()
})

test('irr: a rate above the 1000% ceiling is not found', () => {
  // -1 then +100 has a true rate of 9900%, outside [−0.99, 10].
  expect(irr([-1, 100])).toBeNull()
})

test('irr: a loss-making project has a negative rate', () => {
  // -1000 then 10×90 returns 900 for 1000 spent, so the rate is below zero.
  const rate = irr([-1000, ...Array(10).fill(90)])
  expect(rate).not.toBeNull()
  expect(rate!).toBeLessThan(0)
  expect(rate!).toBeGreaterThan(-0.99)
})

test('irr: result solves NPV = 0 to the bisection tolerance', () => {
  const flows = [-5_000_000, 900_000, 1_100_000, 1_300_000, 1_500_000, 1_700_000, 1_900_000]
  const rate = irr(flows)
  expect(rate).not.toBeNull()
  const npv = flows.reduce((sum, cf, t) => sum + cf / (1 + rate!) ** t, 0)
  expect(Math.abs(npv)).toBeLessThan(1)
})

// --- computeFinance ---

test('hand-computed finance case', () => {
  const f = computeFinance({
    baseline: metrics(100_000),
    lifeline: metrics(10_000),
    size: handSize,
    costs: handCosts,
  })
  expect(f.baselineAnnualNgn).toBe(37_500_000)
  expect(f.capexNgn).toBeCloseTo(2_310_000, 6)
  expect(f.monthlyFeeNgn).toBe(2_500_000)
  expect(f.hospitalSavingsAnnualNgn).toBe(7_500_000)
  expect(f.providerAnnualCashflowNgn).toBeCloseTo(26_303_800, 6)
  expect(f.paybackYears!).toBeCloseTo(0.0878, 3)
})

test('hand-computed case: operating cost, CO2 and an irr above the ceiling', () => {
  const f = computeFinance({
    baseline: metrics(100_000, 400),
    lifeline: metrics(10_000, 150),
    size: handSize,
    costs: handCosts,
  })
  // 10,000 × 365 + 2% of 2,310,000 capex.
  expect(f.lifelineOperatingAnnualNgn).toBeCloseTo(3_696_200, 6)
  // (400 − 150) kg/day × 365 days / 1000.
  expect(f.co2AvoidedTonnesYear).toBeCloseTo(91.25, 9)
  // Cashflow is 11.4× capex every year, so the true rate (about 1,040%) is above the
  // 1000% ceiling: the UI shows "n/a" rather than a number it cannot stand behind.
  expect(f.irr).toBeNull()
})

test('irr is built from -capex then contractYears of provider cashflow', () => {
  // Cashflow equals capex, so flows are [-1, 1, 1] in capex units:
  // NPV = 0 when x + x² = 1, with x = 1/(1+r).
  const capexOnly: CostAssumptions = {
    ...DEFAULT_COSTS,
    pvNgnPerKwp: 1_000_000,
    batteryNgnPerKwh: 0,
    inverterNgnPerKw: 0,
    bosFraction: 0,
    omFractionPerYear: 0,
    generatorMaintNgnPerYear: 0,
    feeFraction: 1,
    contractYears: 2,
  }
  const f = computeFinance({
    baseline: metrics(1_000_000 / 365),
    lifeline: metrics(0),
    size: { pvKwp: 1, batteryKwh: 0, inverterKw: 0 },
    costs: capexOnly,
  })
  expect(f.capexNgn).toBe(1_000_000)
  expect(f.providerAnnualCashflowNgn).toBeCloseTo(1_000_000, 4)
  expect(f.paybackYears!).toBeCloseTo(1, 6)
  // x = (√5 − 1)/2, so r = 1/x − 1 = (√5 − 1)/2 ≈ 0.6180339887.
  expect(f.irr!).toBeCloseTo(0.6180339887, 5)
})

test('co2 avoided can be negative when Lifeline emits more', () => {
  const f = computeFinance({
    baseline: metrics(100_000, 100),
    lifeline: metrics(10_000, 200),
    size: handSize,
    costs: handCosts,
  })
  expect(f.co2AvoidedTonnesYear).toBeCloseTo(-36.5, 9)
})

test('fee 0 → payback and irr null', () => {
  const f = computeFinance({
    baseline: metrics(100_000),
    lifeline: metrics(10_000),
    size: handSize,
    costs: { ...handCosts, feeFraction: 0 },
  })
  expect(f.monthlyFeeNgn).toBe(0)
  expect(f.hospitalSavingsAnnualNgn).toBe(f.baselineAnnualNgn)
  expect(f.providerAnnualCashflowNgn).toBeLessThan(0)
  expect(f.paybackYears).toBeNull()
  expect(f.irr).toBeNull()
  expectFiniteOrNull(f)
})

test('fee 0 and nothing to run: cashflow is exactly 0, payback and irr still null', () => {
  const f = computeFinance({
    baseline: metrics(100_000),
    lifeline: metrics(0),
    size: handSize,
    costs: { ...handCosts, feeFraction: 0, omFractionPerYear: 0 },
  })
  expect(f.providerAnnualCashflowNgn).toBe(0)
  expect(f.paybackYears).toBeNull()
  expect(f.irr).toBeNull()
  expectFiniteOrNull(f)
})

test('capex 0 → payback and irr null', () => {
  const f = computeFinance({
    baseline: metrics(100_000),
    lifeline: metrics(10_000),
    size: zeroSize,
    costs: handCosts,
  })
  expect(f.capexNgn).toBe(0)
  // Fee still earns, so cashflow is positive: only the zero capex blocks payback and irr.
  expect(f.providerAnnualCashflowNgn).toBeGreaterThan(0)
  expect(f.paybackYears).toBeNull()
  expect(f.irr).toBeNull()
  expectFiniteOrNull(f)
})

test('capex 0 from zero unit prices also gives null payback and irr', () => {
  const f = computeFinance({
    baseline: metrics(100_000),
    lifeline: metrics(10_000),
    size: handSize,
    costs: { ...handCosts, pvNgnPerKwp: 0, batteryNgnPerKwh: 0, inverterNgnPerKw: 0 },
  })
  expect(f.capexNgn).toBe(0)
  expect(f.paybackYears).toBeNull()
  expect(f.irr).toBeNull()
  expectFiniteOrNull(f)
})

test('no FinanceResult field is NaN or Infinity for default costs with a zero size', () => {
  const f = computeFinance({
    baseline: metrics(250_000, 300),
    lifeline: metrics(40_000, 60),
    size: zeroSize,
    costs: DEFAULT_COSTS,
  })
  expectFiniteOrNull(f)
})

test('no FinanceResult field is NaN or Infinity for default costs with fee 0', () => {
  const f = computeFinance({
    baseline: metrics(250_000, 300),
    lifeline: metrics(40_000, 60),
    size: handSize,
    costs: { ...DEFAULT_COSTS, feeFraction: 0 },
  })
  expectFiniteOrNull(f)
})

test('no FinanceResult field is NaN or Infinity when every cost is 0', () => {
  const zeroCosts: CostAssumptions = {
    dieselNgnPerLitre: 0,
    gridNgnPerKwh: 0,
    pvNgnPerKwp: 0,
    batteryNgnPerKwh: 0,
    inverterNgnPerKw: 0,
    bosFraction: 0,
    omFractionPerYear: 0,
    generatorMaintNgnPerYear: 0,
    ngnPerUsd: 0,
    feeFraction: 0,
    contractYears: 1,
    dieselLitresPerKwh: 0,
    co2KgPerLitreDiesel: 0,
    gridCo2KgPerKwh: 0,
  }
  const f = computeFinance({
    baseline: metrics(0),
    lifeline: metrics(0),
    size: zeroSize,
    costs: zeroCosts,
  })
  expectFiniteOrNull(f)
  expect(f.paybackYears).toBeNull()
  expect(f.irr).toBeNull()
})

test('kano-50 demo case: the EaaS deal pays back inside the contract', () => {
  const kano = PRESETS.find((p) => p.id === 'kano-50')
  if (!kano) throw new Error('Missing preset kano-50')
  const c = runComparison({
    profile: kano,
    costs: DEFAULT_COSTS,
    seed: DEMO_SEED,
    season: 'typical',
  })
  const f = computeFinance({
    baseline: c.baseline.metrics,
    lifeline: c.lifeline.metrics,
    size: c.size,
    costs: DEFAULT_COSTS,
  })
  expectFiniteOrNull(f)
  expect(f.capexNgn).toBeGreaterThan(0)
  expect(f.hospitalSavingsAnnualNgn).toBeGreaterThan(0)
  expect(f.paybackYears).not.toBeNull()
  expect(f.paybackYears!).toBeLessThan(DEFAULT_COSTS.contractYears)
  expect(f.irr).not.toBeNull()
  expect(f.irr!).toBeGreaterThan(0)
})
