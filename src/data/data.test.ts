import { expect, test } from 'vitest'
import { validateCosts, validateProfile } from '../engine/validate'
import { DEFAULT_COSTS } from './costs'
import { EQUIPMENT_LIBRARY, equipmentId } from './equipment'
import { PRESETS } from './presets'
import { SOLAR_SITES } from './solarSites'
import { SOURCES } from './sources'
import { HOME_STATS } from './stats'

function sourceById(id: string) {
  const source = SOURCES.find((s) => s.id === id)
  if (!source) throw new Error(`Missing source ${id}`)
  return source
}

function presetById(id: string) {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

// --- brief tests ---

test('solar table covers 36 states + FCT', () => expect(Object.keys(SOLAR_SITES)).toHaveLength(37))

test('Kano values match NASA POWER pull', () =>
  expect(SOLAR_SITES.Kano).toMatchObject({ pshAnnual: 6.0, pshWorstMonth: 5.5, worstMonth: 'DEC' }))

test('every preset is valid', () =>
  PRESETS.forEach((p) => expect(validateProfile(p)).toEqual([])))

test('default costs are valid', () => expect(validateCosts(DEFAULT_COSTS)).toEqual([]))

test('every DEFAULT_COSTS key has a source', () =>
  Object.keys(DEFAULT_COSTS).forEach((k) =>
    expect(SOURCES.some((s) => s.id === `cost.${k}`)).toBe(true),
  ))

test('every HOME_STATS sourceId resolves', () =>
  HOME_STATS.forEach((s) => expect(SOURCES.some((x) => x.id === s.sourceId)).toBe(true)))

// --- solar table ---

test('each solar site is keyed by its own state name', () => {
  for (const [key, site] of Object.entries(SOLAR_SITES)) expect(site.state).toBe(key)
})

test('Rivers matches NASA POWER pull', () =>
  expect(SOLAR_SITES.Rivers).toMatchObject({
    capital: 'Port Harcourt',
    pshAnnual: 4.12,
    pshWorstMonth: 3.2,
    worstMonth: 'JUL',
  }))

test('worst month never exceeds the annual average', () => {
  for (const site of Object.values(SOLAR_SITES)) {
    expect(site.pshWorstMonth).toBeLessThanOrEqual(site.pshAnnual)
  }
})

test('every preset state exists in the solar table', () =>
  PRESETS.forEach((p) => expect(SOLAR_SITES[p.state]).toBeDefined()))

// --- equipment and presets ---

test('equipment ids are kebab-case of the name and unique', () => {
  expect(equipmentId('ICU ventilator')).toBe('icu-ventilator')
  expect(equipmentId('Ward LED lighting')).toBe('ward-led-lighting')
  const ids = EQUIPMENT_LIBRARY.map((e) => equipmentId(e.name))
  expect(new Set(ids).size).toBe(ids.length)
})

test('every library schedule has 24 hours', () =>
  EQUIPMENT_LIBRARY.forEach((e) => expect(e.scheduleMask).toHaveLength(24)))

test('schedule masks follow the a–b means hours a..b-1 rule', () => {
  const mask = (name: string) => {
    const item = EQUIPMENT_LIBRARY.find((e) => e.name === name)
    if (!item) throw new Error(`Missing ${name}`)
    return item.scheduleMask
  }
  const hoursOn = (m: boolean[]) => m.flatMap((on, h) => (on ? [h] : []))
  expect(hoursOn(mask('ICU ventilator'))).toHaveLength(24)
  expect(hoursOn(mask('Theatre light'))).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
  expect(hoursOn(mask('Autoclave'))).toEqual([8, 9, 10, 11, 12, 13, 14, 15])
  expect(hoursOn(mask('Ward LED lighting'))).toEqual([0, 1, 2, 3, 4, 5, 18, 19, 20, 21, 22, 23])
})

test('kano-50 preset has the specified site inputs and 27 library rows', () => {
  const kano = presetById('kano-50')
  expect(kano).toMatchObject({
    name: 'General Hospital, Kano (50 beds)',
    state: 'Kano',
    beds: 50,
    gridHoursPerDay: 6,
    dieselLitresPerMonth: 1500,
    generatorKva: 60,
  })
  expect(kano.equipment.map((e) => e.name)).toEqual(EQUIPMENT_LIBRARY.map((e) => e.name))
  expect(kano.equipment.find((e) => e.id === 'ward-led-lighting')?.qty).toBe(120)
})

test('phc preset has the specified site inputs and rows', () => {
  const phc = presetById('phc')
  expect(phc).toMatchObject({
    name: 'Primary Health Centre, FCT',
    state: 'FCT',
    beds: 10,
    gridHoursPerDay: 8,
    dieselLitresPerMonth: 200,
    generatorKva: 10,
  })
  expect(phc.equipment.map((e) => [e.id, e.qty])).toEqual([
    ['vaccine-refrigerator', 1],
    ['oxygen-concentrator', 1],
    ['infant-warmer', 1],
    ['delivery-lamp', 1],
    ['fetal-monitor', 1],
    ['suction-pump', 1],
    ['ward-led-lighting', 20],
    ['security-lighting', 4],
    ['ward-ceiling-fan', 6],
    ['office-laptop', 2],
  ])
})

test('preset rows keep the library watts, duty, hours and tier', () => {
  for (const preset of PRESETS) {
    for (const row of preset.equipment) {
      const template = EQUIPMENT_LIBRARY.find((e) => equipmentId(e.name) === row.id)
      expect(template, `${preset.id}/${row.id} is in the library`).toBeDefined()
      expect(row).toMatchObject({
        name: template?.name,
        ward: template?.ward,
        ratedW: template?.ratedW,
        dutyCycle: template?.dutyCycle,
        scheduleMask: template?.scheduleMask,
        tier: template?.tier,
      })
    }
  }
})

test('preset ids are unique and the demo preset is first', () => {
  const ids = PRESETS.map((p) => p.id)
  expect(ids).toEqual(['kano-50', 'phc'])
})

test('presets do not share mutable schedule arrays', () => {
  const [kano, phc] = PRESETS
  const kanoLaptop = kano.equipment.find((e) => e.id === 'office-laptop')
  const phcLaptop = phc.equipment.find((e) => e.id === 'office-laptop')
  expect(kanoLaptop?.scheduleMask).not.toBe(phcLaptop?.scheduleMask)
})

// --- costs and sources ---

test('default costs equal the HANDOFF numbers', () =>
  expect(DEFAULT_COSTS).toEqual({
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
  }))

test('source ids are unique', () => {
  const ids = SOURCES.map((s) => s.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('cost source values match DEFAULT_COSTS', () => {
  for (const [key, value] of Object.entries(DEFAULT_COSTS)) {
    expect(sourceById(`cost.${key}`).value).toBe(value)
  }
})

test('the diesel price label is the validation label', () =>
  expect(sourceById('cost.dieselNgnPerLitre').label).toBe('Diesel price'))

test('estimate flags follow HANDOFF', () => {
  expect(sourceById('cost.dieselNgnPerLitre').isEstimate).toBe(false)
  expect(sourceById('cost.gridNgnPerKwh').isEstimate).toBe(false)
  expect(sourceById('cost.pvNgnPerKwp').isEstimate).toBe(true)
  expect(sourceById('cost.feeFraction').isEstimate).toBe(false)
  expect(sourceById('cost.co2KgPerLitreDiesel').isEstimate).toBe(false)
  expect(sourceById('cost.gridCo2KgPerKwh').isEstimate).toBe(true)
})

test('every library item has an equip source with its rated watts', () => {
  for (const item of EQUIPMENT_LIBRARY) {
    const source = sourceById(`equip.${equipmentId(item.name)}`)
    expect(source.value).toBe(item.ratedW)
    expect(source.unit).toBe('W')
  }
})

test('only the three SEforALL field-tested items are non-estimates', () => {
  const measured = EQUIPMENT_LIBRARY.filter(
    (item) => !sourceById(`equip.${equipmentId(item.name)}`).isEstimate,
  ).map((item) => item.name)
  expect(measured).toEqual(['Oxygen concentrator', 'Autoclave', 'Infant warmer'])
})

test('every preset has site sources with its values', () => {
  for (const preset of PRESETS) {
    expect(sourceById(`site.${preset.id}.gridHoursPerDay`).value).toBe(preset.gridHoursPerDay)
    expect(sourceById(`site.${preset.id}.dieselLitresPerMonth`).value).toBe(preset.dieselLitresPerMonth)
    expect(sourceById(`site.${preset.id}.generatorKva`).value).toBe(preset.generatorKva)
  }
})

test('stat, context and solar sources exist with the home-page numbers', () => {
  expect(sourceById('stat.outageHours')).toMatchObject({ value: 20, unit: 'h/day' })
  expect(sourceById('stat.phcNoPower')).toMatchObject({ value: 40, unit: '%' })
  expect(sourceById('stat.whoSolar')).toMatchObject({ value: 80, unit: '%' })
  expect(sourceById('stat.kanoIcu')).toBeDefined()
  expect(sourceById('context.nphi')).toBeDefined()
  expect(sourceById('solar.nasaPower')).toMatchObject({ value: 6, unit: 'kWh/m²/day' })
})

test('every source has a non-empty label, unit and source text', () => {
  for (const s of SOURCES) {
    expect(s.label, s.id).not.toBe('')
    expect(s.unit, s.id).not.toBe('')
    expect(s.source, s.id).not.toBe('')
  }
})

test('HOME_STATS has three entries in page order', () => {
  expect(HOME_STATS.map((s) => [s.value, s.sourceId])).toEqual([
    [20, 'stat.outageHours'],
    [40, 'stat.phcNoPower'],
    [80, 'stat.whoSolar'],
  ])
})
