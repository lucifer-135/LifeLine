import { STEPS_PER_DAY } from '../../engine/constants'
import type { Equipment, Tier, TwinStep } from '../../engine/types'
import { isTierShed, isUnderServed } from './roomState'
import type { RoomState } from './roomState'

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

// What the room popover says about an item. The cause decides the word: a tier the
// controller shed is "Paused"; a tier under-served without being shed (diesel-only
// blackout, fuel out, a flat battery) has "No power".
export function itemStatus(item: Equipment, step: number, twinStep: TwinStep): ItemStatus {
  if (!isScheduled(item, step)) return 'idle'
  if (isTierShed(twinStep, item.tier)) return 'paused'
  return isUnderServed(twinStep, item.tier) ? 'no-power' : 'powered'
}

// The room's state with its cause, which sets the label on the plan and the words in the
// room's name. Only life-critical load raises the alarm; other loads without power read
// "No power" or "Partly powered". When some loads are paused and others lost power, the
// lost power is the one to report.
export type RoomCondition = 'lit' | 'partly-paused' | 'paused' | 'partly-powered' | 'no-power' | 'alarm'

export function roomCondition(state: RoomState, items: Equipment[], step: number, twinStep: TwinStep): RoomCondition {
  if (state === 'lit' || state === 'alarm') return state
  const statuses = items.map((item) => itemStatus(item, step, twinStep))
  // A dark room with nothing switched on is dark because the hospital has no power.
  const unpowered = statuses.includes('no-power') || statuses.every((status) => status === 'idle')
  if (state === 'dark') return unpowered ? 'no-power' : 'paused'
  return unpowered ? 'partly-powered' : 'partly-paused'
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
