export type Tier = 'T1' | 'T2' | 'T3'
export type TierKw = Record<Tier, number>
export type Ward =
  | 'ICU'
  | 'Theatre'
  | 'Maternity'
  | 'ColdChain'
  | 'Lab'
  | 'Wards'
  | 'Utilities'
  | 'Admin'
export type Season = 'typical' | 'worst'
export type Scenario = 'baseline' | 'lifeline'

// The 36 states plus the Federal Capital Territory. Must match the keys of SOLAR_SITES.
export type NigerianState =
  | 'Abia'
  | 'Adamawa'
  | 'Akwa Ibom'
  | 'Anambra'
  | 'Bauchi'
  | 'Bayelsa'
  | 'Benue'
  | 'Borno'
  | 'Cross River'
  | 'Delta'
  | 'Ebonyi'
  | 'Edo'
  | 'Ekiti'
  | 'Enugu'
  | 'FCT'
  | 'Gombe'
  | 'Imo'
  | 'Jigawa'
  | 'Kaduna'
  | 'Kano'
  | 'Katsina'
  | 'Kebbi'
  | 'Kogi'
  | 'Kwara'
  | 'Lagos'
  | 'Nasarawa'
  | 'Niger'
  | 'Ogun'
  | 'Ondo'
  | 'Osun'
  | 'Oyo'
  | 'Plateau'
  | 'Rivers'
  | 'Sokoto'
  | 'Taraba'
  | 'Yobe'
  | 'Zamfara'

export interface Equipment {
  id: string
  name: string
  ward: Ward
  ratedW: number
  dutyCycle: number
  scheduleMask: boolean[]
  tier: Tier
  qty: number
}

export interface HospitalProfile {
  id: string
  name: string
  state: NigerianState
  beds: number
  equipment: Equipment[]
  gridHoursPerDay: number
  dieselLitresPerMonth: number
  generatorKva: number
}

export interface SolarSite {
  state: NigerianState
  capital: string
  lat: number
  lon: number
  pshAnnual: number
  pshWorstMonth: number
  worstMonth: string
}

export interface LoadProfile {
  kw: Record<Tier, number[]>
  dailyKwh: TierKw
  peakKw: TierKw
}

export interface GridPattern {
  up: boolean[]
}

export interface SystemSize {
  pvKwp: number
  batteryKwh: number
  inverterKw: number
}

export interface CostAssumptions {
  dieselNgnPerLitre: number
  gridNgnPerKwh: number
  pvNgnPerKwp: number
  batteryNgnPerKwh: number
  inverterNgnPerKw: number
  bosFraction: number
  omFractionPerYear: number
  generatorMaintNgnPerYear: number
  ngnPerUsd: number
  feeFraction: number
  contractYears: number
  dieselLitresPerKwh: number
  co2KgPerLitreDiesel: number
  gridCo2KgPerKwh: number
}

export interface TwinStep {
  t: number
  gridUp: boolean
  loadKw: TierKw
  servedKw: TierKw
  shedT2: boolean
  shedT3: boolean
  pvKw: number
  pvUsedKw: number
  curtailedKw: number
  gridKw: number
  chargeKw: number
  dischargeKw: number
  dieselKw: number
  soc: number
  fuelLitresLeft: number
  t1RunwayMin: number
}

export type TwinEventKind =
  | 'grid_lost'
  | 'grid_restored'
  | 'shed_t3'
  | 'shed_t2'
  | 'restore_t2'
  | 'restore_t3'
  | 'diesel_on'
  | 'diesel_off'
  | 'fuel_out'
  | 't1_unpowered'
  | 't1_restored'

export interface TwinEvent {
  step: number
  kind: TwinEventKind
  t1RunwayMin: number
}

export interface TwinMetrics {
  t1MinutesUnpowered: number
  t2MinutesUnpowered: number
  dieselLitres: number
  gridKwh: number
  energyCostNgn: number
  co2Kg: number
}

export interface TwinResult {
  scenario: Scenario
  steps: TwinStep[]
  events: TwinEvent[]
  metrics: TwinMetrics
}

export interface FinanceResult {
  baselineAnnualNgn: number
  lifelineOperatingAnnualNgn: number
  capexNgn: number
  monthlyFeeNgn: number
  hospitalSavingsAnnualNgn: number
  providerAnnualCashflowNgn: number
  paybackYears: number | null
  irr: number | null
  co2AvoidedTonnesYear: number
}
