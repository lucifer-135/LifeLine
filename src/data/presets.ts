import type { Equipment, HospitalProfile } from '../engine/types'
import { EQUIPMENT_LIBRARY, equipmentId } from './equipment'

// Builds a profile row from the library so every preset keeps the same watts,
// duty cycle, hours and tier. The schedule is copied so presets never share
// one mutable array.
function fromLibrary(name: string, qty: number): Equipment {
  const item = EQUIPMENT_LIBRARY.find((e) => e.name === name)
  if (!item) throw new Error(`Unknown equipment in preset: ${name}`)
  return { ...item, id: equipmentId(item.name), scheduleMask: [...item.scheduleMask], qty }
}

const KANO_QUANTITIES: [name: string, qty: number][] = [
  ['ICU ventilator', 4],
  ['Patient monitor', 6],
  ['Infusion pump', 8],
  ['Oxygen concentrator', 4],
  ['Suction pump', 2],
  ['ICU air conditioner', 2],
  ['Theatre light', 2],
  ['Anaesthesia machine', 1],
  ['Electrosurgical unit', 1],
  ['Theatre air conditioner', 1],
  ['Autoclave', 1],
  ['Infant warmer', 2],
  ['Fetal monitor', 2],
  ['Delivery lamp', 2],
  ['Phototherapy unit', 2],
  ['Vaccine refrigerator', 2],
  ['Blood bank refrigerator', 1],
  ['Lab refrigerator', 1],
  ['Chemistry analyser', 1],
  ['Centrifuge', 1],
  ['Microscope', 2],
  ['Ward LED lighting', 120],
  ['Security lighting', 20],
  ['Water pump', 1],
  ['Ward ceiling fan', 40],
  ['Admin air conditioner', 3],
  ['Office laptop', 10],
]

const PHC_QUANTITIES: [name: string, qty: number][] = [
  ['Vaccine refrigerator', 1],
  ['Oxygen concentrator', 1],
  ['Infant warmer', 1],
  ['Delivery lamp', 1],
  ['Fetal monitor', 1],
  ['Suction pump', 1],
  ['Ward LED lighting', 20],
  ['Security lighting', 4],
  ['Ward ceiling fan', 6],
  ['Office laptop', 2],
]

export const PRESETS: HospitalProfile[] = [
  {
    id: 'kano-50',
    name: 'General Hospital, Kano (50 beds)',
    state: 'Kano',
    beds: 50,
    equipment: KANO_QUANTITIES.map(([name, qty]) => fromLibrary(name, qty)),
    gridHoursPerDay: 6,
    dieselLitresPerMonth: 1500,
    generatorKva: 60,
  },
  {
    id: 'phc',
    name: 'Primary Health Centre, FCT',
    state: 'FCT',
    beds: 10,
    equipment: PHC_QUANTITIES.map(([name, qty]) => fromLibrary(name, qty)),
    gridHoursPerDay: 8,
    dieselLitresPerMonth: 200,
    generatorKva: 10,
  },
]
