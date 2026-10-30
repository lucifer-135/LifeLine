import { SOURCES } from '../data/sources'
import type { CostAssumptions, Equipment, HospitalProfile } from './types'

// Every message here is shown to the user verbatim. All numeric checks go
// through Number.isFinite / Number.isInteger so NaN and ±Infinity from empty
// or garbled form fields are rejected instead of slipping past `>=` / `<=`.

const HOURS_PER_DAY = 24

function isFiniteInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

function validateItem(item: Equipment): string[] {
  const messages: string[] = []
  if (!(Number.isFinite(item.ratedW) && item.ratedW > 0)) {
    messages.push(`${item.name}: rated power must be more than 0 W.`)
  }
  if (!isFiniteInRange(item.dutyCycle, 0, 1)) {
    messages.push(`${item.name}: duty cycle must be between 0 and 1.`)
  }
  if (!(Number.isInteger(item.qty) && item.qty >= 0)) {
    messages.push(`${item.name}: quantity must be a whole number.`)
  }
  if (item.scheduleMask.length !== HOURS_PER_DAY) {
    messages.push(`${item.name}: schedule must have 24 hours.`)
  }
  return messages
}

// Profile-level messages come first, then one group per item in equipment order.
export function validateProfile(p: HospitalProfile): string[] {
  const messages: string[] = []
  if (!(Number.isInteger(p.beds) && p.beds >= 1)) {
    messages.push('Beds must be a whole number of 1 or more.')
  }
  if (!isFiniteInRange(p.gridHoursPerDay, 0, HOURS_PER_DAY)) {
    messages.push('Grid hours must be between 0 and 24.')
  }
  if (!(Number.isFinite(p.dieselLitresPerMonth) && p.dieselLitresPerMonth >= 0)) {
    messages.push('Diesel must be zero or more litres per month.')
  }
  if (!(Number.isFinite(p.generatorKva) && p.generatorKva >= 0)) {
    messages.push('Generator size must be zero or more kVA.')
  }
  if (!p.equipment.some((e) => e.tier === 'T1' && e.qty > 0)) {
    messages.push('Add at least one life-critical item.')
  }
  for (const item of p.equipment) messages.push(...validateItem(item))
  return messages
}

// Costs that only need to be zero or more. feeFraction and contractYears have
// their own rules and are deliberately not in this list.
const NON_NEGATIVE_COST_KEYS: (keyof CostAssumptions)[] = [
  'dieselNgnPerLitre',
  'gridNgnPerKwh',
  'pvNgnPerKwp',
  'batteryNgnPerKwh',
  'inverterNgnPerKw',
  'bosFraction',
  'omFractionPerYear',
  'generatorMaintNgnPerYear',
  'ngnPerUsd',
  'dieselLitresPerKwh',
  'co2KgPerLitreDiesel',
  'gridCo2KgPerKwh',
]

// The label is the source row's label, so the message and the Method page agree.
// The fallback to the raw key only matters if a source row is missing; a test
// guarantees every cost key has one.
function costLabel(key: keyof CostAssumptions): string {
  return SOURCES.find((s) => s.id === `cost.${key}`)?.label ?? key
}

export function validateCosts(c: CostAssumptions): string[] {
  const messages: string[] = []
  for (const key of NON_NEGATIVE_COST_KEYS) {
    const value = c[key]
    if (!(Number.isFinite(value) && value >= 0)) {
      messages.push(`${costLabel(key)} must be zero or more.`)
    }
  }
  if (!isFiniteInRange(c.feeFraction, 0, 1)) {
    messages.push("Fee must be between 0% and 100% of today's spend.")
  }
  if (!(Number.isInteger(c.contractYears) && c.contractYears >= 1 && c.contractYears <= 30)) {
    messages.push('Contract length must be 1–30 years.')
  }
  return messages
}
