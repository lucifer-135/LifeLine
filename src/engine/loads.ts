import { STEPS_PER_DAY, STEP_HOURS } from './constants'
import type { Equipment, LoadProfile, Tier, TierKw } from './types'

const TIERS: Tier[] = ['T1', 'T2', 'T3']
const STEPS_PER_HOUR = STEPS_PER_DAY / 24

function emptyDay(): number[] {
  return Array<number>(STEPS_PER_DAY).fill(0)
}

// Builds the 24-hour demand curve per tier. An item draws ratedW x dutyCycle x qty
// in every step whose hour is switched on in its scheduleMask.
export function buildLoadProfile(equipment: Equipment[]): LoadProfile {
  const kw: Record<Tier, number[]> = { T1: emptyDay(), T2: emptyDay(), T3: emptyDay() }

  for (const item of equipment) {
    const itemKw = (item.ratedW * item.dutyCycle * item.qty) / 1000
    for (let s = 0; s < STEPS_PER_DAY; s++) {
      if (item.scheduleMask[Math.floor(s / STEPS_PER_HOUR)]) kw[item.tier][s] += itemKw
    }
  }

  const dailyKwh: TierKw = { T1: 0, T2: 0, T3: 0 }
  const peakKw: TierKw = { T1: 0, T2: 0, T3: 0 }
  for (const tier of TIERS) {
    dailyKwh[tier] = kw[tier].reduce((sum, v) => sum + v * STEP_HOURS, 0)
    peakKw[tier] = Math.max(0, ...kw[tier])
  }
  return { kw, dailyKwh, peakKw }
}
