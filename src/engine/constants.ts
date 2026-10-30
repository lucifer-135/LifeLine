export const STEPS_PER_DAY = 96
export const STEP_HOURS = 0.25
export const DEMO_SEED = 2026
export const BATTERY_DOD = 0.8 // usable fraction for sizing
export const BATTERY_ROUND_TRIP = 0.9 // charge*discharge efficiency
export const BATTERY_ONE_WAY = Math.sqrt(BATTERY_ROUND_TRIP)
export const BATTERY_RESERVE_SOC = 0.2 // diesel starts below this
export const PV_PERFORMANCE_RATIO = 0.75
export const INVERTER_HEADROOM = 1.25
export const GENERATOR_POWER_FACTOR = 0.8 // kW = kVA * 0.8
export const SUNRISE_HOUR = 6.5
export const SUNSET_HOUR = 18.5
export const PV_STRONG_START_HOUR = 8 // controller "relief" window
export const PV_STRONG_END_HOUR = 16
