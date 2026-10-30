import type { CostAssumptions, FinanceResult, SystemSize, TwinMetrics } from './types'

const DAYS_PER_YEAR = 365
const MONTHS_PER_YEAR = 12
const IRR_LOW = -0.99
const IRR_HIGH = 10
const IRR_TOLERANCE = 1e-7

function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((sum, cashflow, year) => sum + cashflow / (1 + rate) ** year, 0)
}

// Internal rate of return by bisection on [-99%, 1000%]. Null when no rate in that
// range makes NPV zero (no sign change), so the UI shows "n/a" instead of a made-up number.
export function irr(cashflows: number[]): number | null {
  if (cashflows.length === 0 || !cashflows.every(Number.isFinite)) return null
  let low = IRR_LOW
  let high = IRR_HIGH
  let npvLow = npv(low, cashflows)
  const npvHigh = npv(high, cashflows)
  if (!Number.isFinite(npvLow) || !Number.isFinite(npvHigh)) return null
  if (Math.sign(npvLow) * Math.sign(npvHigh) >= 0) return null
  while (high - low > IRR_TOLERANCE) {
    const mid = (low + high) / 2
    const npvMid = npv(mid, cashflows)
    if (npvMid === 0) return mid
    if (npvMid > 0 === npvLow > 0) {
      low = mid
      npvLow = npvMid
    } else {
      high = mid
    }
  }
  return (low + high) / 2
}

export interface FinanceInput {
  baseline: TwinMetrics
  lifeline: TwinMetrics
  size: SystemSize
  costs: CostAssumptions
}

// Energy-as-a-Service: the hospital pays a monthly fee set below today's energy spend,
// and the provider owns the system and pays the leftover grid and diesel cost and O&M.
// Payback and IRR are null (shown "n/a") whenever the provider has no positive return
// to measure, so no division by zero reaches the UI.
export function computeFinance({ baseline, lifeline, size, costs }: FinanceInput): FinanceResult {
  const baselineAnnualNgn =
    baseline.energyCostNgn * DAYS_PER_YEAR + costs.generatorMaintNgnPerYear
  const capexNgn =
    (size.pvKwp * costs.pvNgnPerKwp +
      size.batteryKwh * costs.batteryNgnPerKwh +
      size.inverterKw * costs.inverterNgnPerKw) *
    (1 + costs.bosFraction)
  const monthlyFeeNgn = (costs.feeFraction * baselineAnnualNgn) / MONTHS_PER_YEAR
  const lifelineOperatingAnnualNgn =
    lifeline.energyCostNgn * DAYS_PER_YEAR + costs.omFractionPerYear * capexNgn
  const providerAnnualCashflowNgn = MONTHS_PER_YEAR * monthlyFeeNgn - lifelineOperatingAnnualNgn
  const hospitalSavingsAnnualNgn = baselineAnnualNgn - MONTHS_PER_YEAR * monthlyFeeNgn
  const hasReturn = capexNgn > 0 && providerAnnualCashflowNgn > 0
  const contractCashflows = Array.from(
    { length: costs.contractYears },
    () => providerAnnualCashflowNgn,
  )
  return {
    baselineAnnualNgn,
    lifelineOperatingAnnualNgn,
    capexNgn,
    monthlyFeeNgn,
    hospitalSavingsAnnualNgn,
    providerAnnualCashflowNgn,
    paybackYears: hasReturn ? capexNgn / providerAnnualCashflowNgn : null,
    irr: capexNgn > 0 ? irr([-capexNgn, ...contractCashflows]) : null,
    co2AvoidedTonnesYear: ((baseline.co2Kg - lifeline.co2Kg) * DAYS_PER_YEAR) / 1000,
  }
}
