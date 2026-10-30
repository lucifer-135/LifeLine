import type { Equipment, Tier, Ward } from '../engine/types'

export type EquipmentTemplate = Omit<Equipment, 'qty' | 'id'>

// "a–b" means hours a through b-1, so [8, 17] is on from 08:00 up to 17:00.
type HourRange = [startHour: number, endHour: number]

function hoursMask(...ranges: HourRange[]): boolean[] {
  return Array.from({ length: 24 }, (_, hour) =>
    ranges.some(([start, end]) => hour >= start && hour < end),
  )
}

const ALL_DAY = hoursMask([0, 24])
const OFFICE = hoursMask([8, 17])
const NIGHT = hoursMask([18, 24], [0, 6])

// Ids are the kebab-case of the name, e.g. "ICU ventilator" -> "icu-ventilator".
export function equipmentId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function template(
  name: string,
  ward: Ward,
  ratedW: number,
  dutyCycle: number,
  scheduleMask: boolean[],
  tier: Tier,
): EquipmentTemplate {
  return { name, ward, ratedW, dutyCycle, scheduleMask, tier }
}

// Oxygen concentrator, infant warmer and autoclave use SEforALL (July 2025)
// field-tested values. The rest are typical manufacturer ratings (see sources.ts).
export const EQUIPMENT_LIBRARY: EquipmentTemplate[] = [
  template('ICU ventilator', 'ICU', 250, 1.0, ALL_DAY, 'T1'),
  template('Patient monitor', 'ICU', 60, 1.0, ALL_DAY, 'T1'),
  template('Infusion pump', 'ICU', 20, 1.0, ALL_DAY, 'T1'),
  template('Oxygen concentrator', 'ICU', 480, 0.8, ALL_DAY, 'T1'),
  template('Suction pump', 'ICU', 150, 0.2, ALL_DAY, 'T1'),
  template('ICU air conditioner', 'ICU', 1500, 0.6, ALL_DAY, 'T2'),
  template('Theatre light', 'Theatre', 150, 1.0, OFFICE, 'T1'),
  template('Anaesthesia machine', 'Theatre', 300, 1.0, OFFICE, 'T1'),
  template('Electrosurgical unit', 'Theatre', 400, 0.2, OFFICE, 'T1'),
  template('Theatre air conditioner', 'Theatre', 2000, 0.6, OFFICE, 'T2'),
  template('Autoclave', 'Theatre', 1650, 0.25, hoursMask([8, 16]), 'T2'),
  template('Infant warmer', 'Maternity', 800, 0.5, ALL_DAY, 'T1'),
  template('Fetal monitor', 'Maternity', 40, 1.0, ALL_DAY, 'T1'),
  template('Delivery lamp', 'Maternity', 100, 0.5, ALL_DAY, 'T1'),
  template('Phototherapy unit', 'Maternity', 150, 0.7, ALL_DAY, 'T2'),
  template('Vaccine refrigerator', 'ColdChain', 100, 0.5, ALL_DAY, 'T1'),
  template('Blood bank refrigerator', 'ColdChain', 250, 0.5, ALL_DAY, 'T1'),
  template('Lab refrigerator', 'Lab', 150, 0.5, ALL_DAY, 'T2'),
  template('Chemistry analyser', 'Lab', 400, 0.5, OFFICE, 'T2'),
  template('Centrifuge', 'Lab', 300, 0.3, OFFICE, 'T2'),
  template('Microscope', 'Lab', 30, 1.0, OFFICE, 'T2'),
  template('Ward LED lighting', 'Wards', 10, 1.0, NIGHT, 'T2'),
  template('Security lighting', 'Utilities', 20, 1.0, NIGHT, 'T2'),
  template('Water pump', 'Utilities', 1100, 0.25, hoursMask([6, 20]), 'T2'),
  template('Ward ceiling fan', 'Wards', 75, 1.0, ALL_DAY, 'T3'),
  template('Admin air conditioner', 'Admin', 1500, 0.6, hoursMask([9, 17]), 'T3'),
  template('Office laptop', 'Admin', 50, 1.0, OFFICE, 'T3'),
]
