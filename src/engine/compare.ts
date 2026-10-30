import { SOLAR_SITES } from '../data/solarSites'
import { GENERATOR_POWER_FACTOR } from './constants'
import { generateGridPattern } from './grid'
import { buildLoadProfile } from './loads'
import { sizeSystem } from './sizing'
import { runTwin } from './twin'
import type {
  CostAssumptions,
  GridPattern,
  HospitalProfile,
  LoadProfile,
  Season,
  SolarSite,
  SystemSize,
  TwinResult,
} from './types'

const DAYS_PER_MONTH = 30

export interface ComparisonInput {
  profile: HospitalProfile
  costs: CostAssumptions
  seed: number
  season: Season
}

export interface Comparison {
  load: LoadProfile
  grid: GridPattern
  size: SystemSize
  site: SolarSite
  baseline: TwinResult
  lifeline: TwinResult
}

// The one engine call the UI makes: today's diesel-only day against the Lifeline
// day, on the same load and the same grid outages.
export function runComparison(input: ComparisonInput): Comparison {
  const { profile, costs, seed, season } = input
  const load = buildLoadProfile(profile.equipment)
  const grid = generateGridPattern(profile.gridHoursPerDay, seed)
  const site = SOLAR_SITES[profile.state]
  const size = sizeSystem(load, grid, profile.gridHoursPerDay, site)
  const psh = season === 'worst' ? site.pshWorstMonth : site.pshAnnual
  const twinInput = {
    load,
    grid,
    size,
    psh,
    generatorKw: profile.generatorKva * GENERATOR_POWER_FACTOR,
    fuelLitresPerDay: profile.dieselLitresPerMonth / DAYS_PER_MONTH,
    costs,
  }
  return {
    load,
    grid,
    size,
    site,
    baseline: runTwin({ ...twinInput, scenario: 'baseline' }),
    lifeline: runTwin({ ...twinInput, scenario: 'lifeline' }),
  }
}
