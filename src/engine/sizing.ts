import {
  BATTERY_DOD,
  BATTERY_ROUND_TRIP,
  INVERTER_HEADROOM,
  PV_PERFORMANCE_RATIO,
  STEPS_PER_DAY,
  STEP_HOURS,
} from './constants'
import { longestOutageHours } from './grid'
import { solarShape } from './solar'
import type { GridPattern, LoadProfile, SolarSite, SystemSize } from './types'

// Float sums such as 24.000000000000004 are really whole numbers. Without this
// tolerance they would round up to the next step and oversize the system.
const CEIL_TOLERANCE = 1e-9

// Rounds up to a multiple of `step`. Zero, negative and non-finite input give 0
// so that sizing always returns finite values.
function ceilToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) return 0
  const steps = Math.ceil(value / step - CEIL_TOLERANCE)
  return steps <= 0 ? 0 : steps * step
}

export function ceilTo1(value: number): number {
  return ceilToStep(value, 1)
}

export function ceilTo5(value: number): number {
  return ceilToStep(value, 5)
}

// Life-critical plus essential demand. Can-wait load is shed first, so it never sizes the system.
function protectedKw(load: LoadProfile, step: number): number {
  return load.kw.T1[step] + load.kw.T2[step]
}

// Battery: PV covers the daytime part of an outage, so only night energy needs storing,
// scaled down when the longest outage is shorter than the night.
// PV: sized on the worst month so the system still holds in the August rains.
// Inverter: peak protected load plus headroom.
export function sizeSystem(
  load: LoadProfile,
  grid: GridPattern,
  gridHoursPerDay: number,
  site: SolarSite,
): SystemSize {
  let nightKwh = 0
  let nightSteps = 0
  let peakProtectedKw = 0
  for (let s = 0; s < STEPS_PER_DAY; s++) {
    const kw = protectedKw(load, s)
    peakProtectedKw = Math.max(peakProtectedKw, kw)
    if (solarShape(s) === 0) {
      nightKwh += kw * STEP_HOURS
      nightSteps += 1
    }
  }

  const nightHours = nightSteps * STEP_HOURS
  const outageShare = nightHours === 0 ? 0 : Math.min(1, longestOutageHours(grid) / nightHours)
  const batteryKwh = ceilTo5((nightKwh * outageShare) / (BATTERY_DOD * BATTERY_ROUND_TRIP))

  const protectedDailyKwh = load.dailyKwh.T1 + load.dailyKwh.T2
  const offGridShare = 1 - gridHoursPerDay / 24
  const pvKwp = ceilTo1(
    (protectedDailyKwh * offGridShare) /
      BATTERY_ROUND_TRIP /
      (site.pshWorstMonth * PV_PERFORMANCE_RATIO),
  )

  const inverterKw = ceilTo1(INVERTER_HEADROOM * peakProtectedKw)

  return { batteryKwh, pvKwp, inverterKw }
}
