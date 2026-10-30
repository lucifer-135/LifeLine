import { expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import type { CostAssumptions, Equipment, HospitalProfile } from './types'
import { validateCosts, validateProfile } from './validate'

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

const kano = presetById('kano-50')
const firstItem: Equipment = kano.equipment[0]

function withItem(changes: Partial<Equipment>): HospitalProfile {
  return { ...kano, equipment: [{ ...firstItem, ...changes }] }
}

// --- validateProfile: brief tests ---

test('rejects profile with no T1 load', () =>
  expect(
    validateProfile({ ...kano, equipment: kano.equipment.filter((e) => e.tier !== 'T1') }),
  ).toContain('Add at least one life-critical item.'))

test('rejects all-zero quantities', () =>
  expect(
    validateProfile({ ...kano, equipment: kano.equipment.map((e) => ({ ...e, qty: 0 })) }),
  ).toContain('Add at least one life-critical item.'))

test('rejects grid hours outside 0–24', () =>
  expect(validateProfile({ ...kano, gridHoursPerDay: 25 })).toContain(
    'Grid hours must be between 0 and 24.',
  ))

test('rejects bad duty cycle', () =>
  expect(validateProfile(withItem({ dutyCycle: 1.5 }))).toContain(
    `${firstItem.name}: duty cycle must be between 0 and 1.`,
  ))

// --- validateProfile: remaining rules ---

test('accepts both presets with no messages', () => {
  expect(validateProfile(kano)).toEqual([])
  expect(validateProfile(presetById('phc'))).toEqual([])
})

test('rejects beds that are not a whole number of 1 or more', () => {
  const message = 'Beds must be a whole number of 1 or more.'
  expect(validateProfile({ ...kano, beds: 0 })).toContain(message)
  expect(validateProfile({ ...kano, beds: 2.5 })).toContain(message)
  expect(validateProfile({ ...kano, beds: Number.NaN })).toContain(message)
  expect(validateProfile({ ...kano, beds: 1 })).not.toContain(message)
})

test('accepts grid hours at the 0 and 24 edges', () => {
  expect(validateProfile({ ...kano, gridHoursPerDay: 0 })).toEqual([])
  expect(validateProfile({ ...kano, gridHoursPerDay: 24 })).toEqual([])
})

test('rejects negative and non-finite grid hours', () => {
  const message = 'Grid hours must be between 0 and 24.'
  expect(validateProfile({ ...kano, gridHoursPerDay: -1 })).toContain(message)
  expect(validateProfile({ ...kano, gridHoursPerDay: Number.NaN })).toContain(message)
  expect(validateProfile({ ...kano, gridHoursPerDay: Number.POSITIVE_INFINITY })).toContain(message)
})

test('rejects negative and non-finite diesel budget, accepts zero', () => {
  const message = 'Diesel must be zero or more litres per month.'
  expect(validateProfile({ ...kano, dieselLitresPerMonth: -1 })).toContain(message)
  expect(validateProfile({ ...kano, dieselLitresPerMonth: Number.NaN })).toContain(message)
  expect(validateProfile({ ...kano, dieselLitresPerMonth: 0 })).toEqual([])
})

test('rejects negative and non-finite generator size, accepts zero', () => {
  const message = 'Generator size must be zero or more kVA.'
  expect(validateProfile({ ...kano, generatorKva: -5 })).toContain(message)
  expect(validateProfile({ ...kano, generatorKva: Number.POSITIVE_INFINITY })).toContain(message)
  expect(validateProfile({ ...kano, generatorKva: 0 })).toEqual([])
})

test('rejects an item with rated power of 0 W or less, or not a number', () => {
  const message = `${firstItem.name}: rated power must be more than 0 W.`
  expect(validateProfile(withItem({ ratedW: 0 }))).toContain(message)
  expect(validateProfile(withItem({ ratedW: -10 }))).toContain(message)
  expect(validateProfile(withItem({ ratedW: Number.NaN }))).toContain(message)
})

test('rejects non-finite and negative duty cycle, accepts 0 and 1', () => {
  const message = `${firstItem.name}: duty cycle must be between 0 and 1.`
  expect(validateProfile(withItem({ dutyCycle: -0.1 }))).toContain(message)
  expect(validateProfile(withItem({ dutyCycle: Number.NaN }))).toContain(message)
  expect(validateProfile(withItem({ dutyCycle: 0 }))).not.toContain(message)
  expect(validateProfile(withItem({ dutyCycle: 1 }))).not.toContain(message)
})

test('rejects an item quantity that is negative or not a whole number', () => {
  const message = `${firstItem.name}: quantity must be a whole number.`
  expect(validateProfile(withItem({ qty: -1 }))).toContain(message)
  expect(validateProfile(withItem({ qty: 1.5 }))).toContain(message)
  expect(validateProfile(withItem({ qty: Number.NaN }))).toContain(message)
})

test('rejects a schedule that does not have 24 hours', () => {
  const message = `${firstItem.name}: schedule must have 24 hours.`
  expect(validateProfile(withItem({ scheduleMask: Array(23).fill(true) }))).toContain(message)
  expect(validateProfile(withItem({ scheduleMask: Array(25).fill(true) }))).toContain(message)
})

test('lists profile-level messages first, then items in equipment order', () => {
  const second: Equipment = kano.equipment[1]
  const messages = validateProfile({
    ...kano,
    beds: 0,
    equipment: [
      { ...firstItem, dutyCycle: 2 },
      { ...second, qty: 1.5 },
    ],
  })
  expect(messages).toEqual([
    'Beds must be a whole number of 1 or more.',
    `${firstItem.name}: duty cycle must be between 0 and 1.`,
    `${second.name}: quantity must be a whole number.`,
  ])
})

// --- validateCosts ---

test('rejects negative cost', () =>
  expect(validateCosts({ ...DEFAULT_COSTS, dieselNgnPerLitre: -1 })).toContain(
    'Diesel price must be zero or more.',
  ))

test('rejects fee fraction above 1', () =>
  expect(validateCosts({ ...DEFAULT_COSTS, feeFraction: 1.2 })).toContain(
    "Fee must be between 0% and 100% of today's spend.",
  ))

const COST_LABELS: [keyof CostAssumptions, string][] = [
  ['dieselNgnPerLitre', 'Diesel price'],
  ['gridNgnPerKwh', 'Grid tariff'],
  ['pvNgnPerKwp', 'Solar panel cost'],
  ['batteryNgnPerKwh', 'Battery cost'],
  ['inverterNgnPerKw', 'Inverter cost'],
  ['bosFraction', 'Balance of system'],
  ['omFractionPerYear', 'Operations and maintenance'],
  ['generatorMaintNgnPerYear', 'Generator maintenance'],
  ['ngnPerUsd', 'Exchange rate'],
  ['dieselLitresPerKwh', 'Diesel use per kWh'],
  ['co2KgPerLitreDiesel', 'Diesel CO₂ factor'],
  ['gridCo2KgPerKwh', 'Grid CO₂ factor'],
]

test.each(COST_LABELS)('rejects a negative %s with its label', (key, label) => {
  expect(validateCosts({ ...DEFAULT_COSTS, [key]: -1 })).toEqual([`${label} must be zero or more.`])
})

test('rejects NaN and Infinity in costs', () => {
  expect(validateCosts({ ...DEFAULT_COSTS, gridNgnPerKwh: Number.NaN })).toEqual([
    'Grid tariff must be zero or more.',
  ])
  expect(validateCosts({ ...DEFAULT_COSTS, pvNgnPerKwp: Number.POSITIVE_INFINITY })).toEqual([
    'Solar panel cost must be zero or more.',
  ])
  expect(validateCosts({ ...DEFAULT_COSTS, feeFraction: Number.NaN })).toEqual([
    "Fee must be between 0% and 100% of today's spend.",
  ])
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: Number.NaN })).toEqual([
    'Contract length must be 1–30 years.',
  ])
})

test('accepts zero costs and fee fraction edges 0 and 1', () => {
  expect(validateCosts({ ...DEFAULT_COSTS, pvNgnPerKwp: 0, feeFraction: 0 })).toEqual([])
  expect(validateCosts({ ...DEFAULT_COSTS, feeFraction: 1 })).toEqual([])
})

test('fee fraction below 0 gets only its own message', () => {
  expect(validateCosts({ ...DEFAULT_COSTS, feeFraction: -0.1 })).toEqual([
    "Fee must be between 0% and 100% of today's spend.",
  ])
})

test('contract length gets only its own message', () => {
  const message = 'Contract length must be 1–30 years.'
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: 0 })).toEqual([message])
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: 31 })).toEqual([message])
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: 2.5 })).toEqual([message])
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: 1 })).toEqual([])
  expect(validateCosts({ ...DEFAULT_COSTS, contractYears: 30 })).toEqual([])
})
