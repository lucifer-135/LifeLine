import { STEPS_PER_DAY } from '../../engine/constants'
import type {
  Equipment,
  HospitalProfile,
  Tier,
  TwinResult,
  TwinStep,
  Ward,
} from '../../engine/types'

export type RoomState = 'lit' | 'dim' | 'dark' | 'alarm'

type Wards = Ward | readonly Ward[]

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const EPS = 1e-9

function wardList(ward: Wards): readonly Ward[] {
  return typeof ward === 'string' ? [ward] : ward
}

function itemsIn(ward: Wards, profile: HospitalProfile): Equipment[] {
  const wards = wardList(ward)
  return profile.equipment.filter((item) => item.qty > 0 && wards.includes(item.ward))
}

// True when the profile has equipment in the ward(s), whatever the time of day, so
// the map can leave out rooms that do not exist in this hospital.
export function hasEquipment(ward: Wards, profile: HospitalProfile): boolean {
  return itemsIn(ward, profile).length > 0
}

function isUnderServed(step: TwinStep, tier: Tier): boolean {
  return step.servedKw[tier] < step.loadKw[tier] - EPS
}

// The baseline never sets shed flags, yet it serves nothing at the start of an outage
// or once the fuel runs out. Counting under-served load as off makes its rooms go dark
// too, so the map tells the same story as the numbers.
function isTierOff(step: TwinStep, tier: Tier): boolean {
  if (tier === 'T2' && step.shedT2) return true
  if (tier === 'T3' && step.shedT3) return true
  return isUnderServed(step, tier)
}

// Light state of a room at one step. Only equipment switched on by its schedule counts,
// because a theatre at 02:00 has no load to lose. The service is judged per tier, not
// per item, since the twin tracks served kW by tier for the whole hospital.
export function roomState(
  ward: Wards,
  step: number,
  result: TwinResult,
  profile: HospitalProfile,
): RoomState {
  const hour = Math.floor(step / STEPS_PER_HOUR)
  const active = itemsIn(ward, profile).filter((item) => item.scheduleMask[hour])
  if (active.length === 0) return 'lit'

  const twinStep = result.steps[step]
  if (active.some((item) => item.tier === 'T1') && isUnderServed(twinStep, 'T1')) return 'alarm'

  const off = active.filter((item) => isTierOff(twinStep, item.tier)).length
  if (off === 0) return 'lit'
  return off === active.length ? 'dark' : 'dim'
}
