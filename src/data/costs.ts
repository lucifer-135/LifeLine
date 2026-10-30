import type { CostAssumptions } from '../engine/types'

// Defaults at May 2026 prices. Every value has a row in sources.ts.
export const DEFAULT_COSTS: CostAssumptions = {
  dieselNgnPerLitre: 3277,
  gridNgnPerKwh: 209.5,
  pvNgnPerKwp: 450000,
  batteryNgnPerKwh: 200000,
  inverterNgnPerKw: 240000,
  bosFraction: 0.15,
  omFractionPerYear: 0.02,
  generatorMaintNgnPerYear: 3000000,
  ngnPerUsd: 1600,
  feeFraction: 0.8,
  contractYears: 10,
  dieselLitresPerKwh: 0.3,
  co2KgPerLitreDiesel: 2.68,
  gridCo2KgPerKwh: 0.43,
}
