import { STEPS_PER_DAY } from '../../engine/constants'
import type { Equipment, Tier, TwinStep } from '../../engine/types'
import { isTierOff, isUnderServed } from './roomState'

// What the room popover says about one item at one step.
export type ItemStatus = 'powered' | 'paused' | 'no-power' | 'idle'

export const ITEM_STATUS_TEXT: Record<ItemStatus, string> = {
  powered: 'Powered',
  paused: 'Paused',
  'no-power': 'No power',
  idle: 'Not in use now',
}

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const EPS = 1e-9

// Average draw while switched on, the same figure the load profile uses.
export function itemKw(item: Equipment): number {
  return (item.ratedW * item.dutyCycle * item.qty) / 1000
}

function isScheduled(item: Equipment, step: number): boolean {
  return item.scheduleMask[Math.floor(step / STEPS_PER_HOUR)] === true
}

// The status follows the same rules as the room's light (roomState): a life-critical item
// is "No power" when its tier is under-served; any other tier is "Paused" when it is shed
// or under-served.
export function itemStatus(item: Equipment, step: number, twinStep: TwinStep): ItemStatus {
  if (!isScheduled(item, step)) return 'idle'
  if (item.tier === 'T1' && isUnderServed(twinStep, 'T1')) return 'no-power'
  return isTierOff(twinStep, item.tier) ? 'paused' : 'powered'
}

// The twin serves load per tier for the whole hospital, so a room's share of a tier is
// served in the same proportion as the tier.
function servedShare(twinStep: TwinStep, tier: Tier): number {
  const load = twinStep.loadKw[tier]
  if (load <= EPS) return 1
  return Math.min(1, Math.max(0, twinStep.servedKw[tier] / load))
}

export function roomServedKw(items: Equipment[], step: number, twinStep: TwinStep): number {
  return items.reduce(
    (sum, item) => (isScheduled(item, step) ? sum + itemKw(item) * servedShare(twinStep, item.tier) : sum),
    0,
  )
}
