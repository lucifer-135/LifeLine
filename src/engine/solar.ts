import { PV_PERFORMANCE_RATIO, STEPS_PER_DAY, SUNRISE_HOUR, SUNSET_HOUR } from './constants'

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const DAYLIGHT_HOURS = SUNSET_HOUR - SUNRISE_HOUR

// Share of the day's PV energy produced per hour at this step: a half-sine between
// sunrise and sunset. The (pi / 2L) scale makes the area under the curve exactly 1,
// so kWp x PSH x performance ratio x shape x STEP_HOURS sums to the day's kWh.
export function solarShape(step: number): number {
  const midpointHour = (step + 0.5) / STEPS_PER_HOUR
  if (midpointHour <= SUNRISE_HOUR || midpointHour >= SUNSET_HOUR) return 0
  const daylightFraction = (midpointHour - SUNRISE_HOUR) / DAYLIGHT_HOURS
  return (Math.PI / (2 * DAYLIGHT_HOURS)) * Math.sin(Math.PI * daylightFraction)
}

export function pvOutputKw(pvKwp: number, psh: number, step: number): number {
  return pvKwp * psh * PV_PERFORMANCE_RATIO * solarShape(step)
}
