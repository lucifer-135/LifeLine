import { formatRunway } from '../lib/format'
import { STEPS_PER_DAY } from './constants'
import type { TwinEvent } from './types'

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const MINUTES_PER_STEP = 60 / STEPS_PER_HOUR

// "HH:MM" clock time at the start of a step, e.g. step 58 is "14:30".
export function stepToClock(step: number): string {
  const hours = Math.floor(step / STEPS_PER_HOUR)
  const minutes = (step % STEPS_PER_HOUR) * MINUTES_PER_STEP
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

// Event-log copy. DESIGN.md §8 owns the wording.
export function formatEvent(e: TwinEvent): string {
  switch (e.kind) {
    case 'grid_lost':
      return `Grid lost. ICU covered for ${formatRunway(e.t1RunwayMin)}.`
    case 'grid_restored':
      return 'Grid power is back.'
    case 'shed_t3':
      return 'Paused loads that can wait (fans, office AC).'
    case 'shed_t2':
      return 'Paused essential loads to protect life-critical care.'
    case 'restore_t3':
      return 'Loads that can wait are back on.'
    case 'restore_t2':
      return 'Essential loads are back on.'
    case 'diesel_on':
      return 'Generator started.'
    case 'diesel_off':
      return 'Generator stopped.'
    case 'fuel_out':
      return 'Diesel ran out.'
    case 't1_unpowered':
      return 'Life-critical equipment has no power.'
    case 't1_restored':
      return 'Life-critical power restored.'
  }
}
