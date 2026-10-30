// "11h 20m" for a runway, "45m" under an hour. Rounds to the nearest minute.
export function formatDuration(min: number): string {
  if (!Number.isFinite(min)) return '—'
  const totalMin = Math.max(0, Math.round(min))
  if (totalMin < 60) return `${totalMin}m`
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}

// Beyond this the exact figure means little, and with almost no life-critical load the
// engine's runway grows towards billions of hours.
const RUNWAY_CAP_MIN = 99 * 60

// A runway for the gauge and the event log: "over 99h" past the cap, otherwise as
// formatDuration. A non-finite value stays a dash.
export function formatRunway(min: number): string {
  return Number.isFinite(min) && min > RUNWAY_CAP_MIN ? 'over 99h' : formatDuration(min)
}

const NOT_AVAILABLE = 'n/a'
const COMPACT_SUFFIXES = ['', 'K', 'M', 'B']
const LAST_COMPACT_UNIT = COMPACT_SUFFIXES.length - 1

// Whole numbers below 1,000; otherwise one decimal while the scaled value is under
// 100 ("68.7"), none from 100 up ("950").
function roundScaled(scaled: number, unit: number): string {
  if (unit === 0) return String(Math.round(scaled))
  const oneDecimal = Math.round(scaled * 10) / 10
  return oneDecimal < 100 ? oneDecimal.toFixed(1) : String(Math.round(scaled))
}

function compactMagnitude(magnitude: number): string {
  let unit = 0
  let scaled = magnitude
  while (unit < LAST_COMPACT_UNIT && scaled >= 1000) {
    scaled /= 1000
    unit += 1
  }
  let text = roundScaled(scaled, unit)
  // Rounding can reach 1000 of the unit (999,960 -> "1000K"), which must read "1.0M".
  if (unit < LAST_COMPACT_UNIT && Number(text) >= 1000) {
    scaled /= 1000
    unit += 1
    text = roundScaled(scaled, unit)
  }
  return `${text}${COMPACT_SUFFIXES[unit]}`
}

// The minus sign is dropped when the amount rounds to zero, so the UI never shows "-₦0".
function signed(symbol: string, magnitudeText: string, isNegative: boolean): string {
  const sign = isNegative && magnitudeText !== '0' ? '-' : ''
  return `${sign}${symbol}${magnitudeText}`
}

const FULL_NGN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// "₦68.7M" compact (default), "₦68,700,000" full. "n/a" for NaN or Infinity.
export function formatNgn(n: number, mode: 'compact' | 'full' = 'compact'): string {
  if (!Number.isFinite(n)) return NOT_AVAILABLE
  const magnitudeText =
    mode === 'full' ? FULL_NGN.format(Math.round(Math.abs(n))) : compactMagnitude(Math.abs(n))
  return signed('₦', magnitudeText, n < 0)
}

// Secondary value shown next to naira. A rate of 0 is allowed by cost validation, so it
// has to read "n/a" here rather than divide to Infinity.
export function formatUsd(ngn: number, ngnPerUsd: number): string {
  if (!Number.isFinite(ngn) || !Number.isFinite(ngnPerUsd) || ngnPerUsd <= 0) return NOT_AVAILABLE
  const usd = ngn / ngnPerUsd
  if (!Number.isFinite(usd)) return NOT_AVAILABLE
  return signed('$', compactMagnitude(Math.abs(usd)), usd < 0)
}

// 0.151 -> "15.1%". Rounds first so a tiny negative reads "0.0%", not "-0.0%".
export function formatPct(x: number): string {
  if (!Number.isFinite(x)) return NOT_AVAILABLE
  return `${(Math.round(x * 1000) / 10).toFixed(1)}%`
}

export function formatYears(y: number | null): string {
  if (y === null || !Number.isFinite(y)) return NOT_AVAILABLE
  return `${y.toFixed(1)} yrs`
}

const WHOLE_NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

// Rounds first, and adds 0 so a tiny negative reads "0", not "-0". Overflowed values
// (a huge CO₂ factor times the litres) read "n/a" instead of "Infinity".
function formatWhole(n: number): string {
  if (!Number.isFinite(n)) return NOT_AVAILABLE
  return WHOLE_NUMBER.format(Math.round(n) + 0)
}

// 1234.5 -> "1,235 L". "n/a" for NaN or Infinity.
export function formatLitres(litres: number): string {
  const whole = formatWhole(litres)
  return whole === NOT_AVAILABLE ? whole : `${whole} L`
}

// 4521.2 -> "4,521 kg". "n/a" for NaN or Infinity.
export function formatKg(kg: number): string {
  const whole = formatWhole(kg)
  return whole === NOT_AVAILABLE ? whole : `${whole} kg`
}
