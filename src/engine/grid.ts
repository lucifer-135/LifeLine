import { STEPS_PER_DAY, STEP_HOURS } from './constants'
import { mulberry32 } from './rng'
import type { GridPattern } from './types'

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const MAX_OUTAGE_BLOCKS = 3

// Splits `total` steps into `blocks` runs of random relative size. Every run is at
// least 1 step and the runs add up to exactly `total`.
function splitIntoRuns(total: number, blocks: number, rng: () => number): number[] {
  const weights = Array.from({ length: blocks }, () => 0.5 + rng())
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const runs = weights.map((w) => Math.max(1, Math.floor((total * w) / weightSum)))

  const assigned = runs.reduce((a, b) => a + b, 0)
  if (assigned < total) runs[blocks - 1] += total - assigned
  // Bumping a run up to 1 can overshoot. Take the surplus from the largest run,
  // which always has room because total >= blocks.
  for (let surplus = assigned - total; surplus > 0; surplus--) {
    runs[runs.indexOf(Math.max(...runs))] -= 1
  }
  return runs
}

// Nigerian grid supply fails in a few long blocks, not scattered steps, so the day
// is built from alternating outage and supply runs and then shifted by a random offset.
export function generateGridPattern(gridHoursPerDay: number, seed: number): GridPattern {
  const hours = Math.min(24, Math.max(0, gridHoursPerDay))
  const upTotal = Math.round(hours * STEPS_PER_HOUR)
  const downTotal = STEPS_PER_DAY - upTotal
  if (downTotal === 0) return { up: Array<boolean>(STEPS_PER_DAY).fill(true) }
  if (upTotal === 0) return { up: Array<boolean>(STEPS_PER_DAY).fill(false) }

  const rng = mulberry32(seed)
  const blocks = Math.min(MAX_OUTAGE_BLOCKS, upTotal, downTotal)
  const downRuns = splitIntoRuns(downTotal, blocks, rng)
  const upRuns = splitIntoRuns(upTotal, blocks, rng)

  const sequence: boolean[] = []
  for (let b = 0; b < blocks; b++) {
    sequence.push(...Array<boolean>(downRuns[b]).fill(false))
    sequence.push(...Array<boolean>(upRuns[b]).fill(true))
  }

  const offset = Math.floor(rng() * STEPS_PER_DAY)
  const up = Array<boolean>(STEPS_PER_DAY).fill(false)
  sequence.forEach((isUp, i) => {
    up[(i + offset) % STEPS_PER_DAY] = isUp
  })
  return { up }
}

// The day is circular: an outage running past midnight continues into the morning.
export function longestOutageHours(grid: GridPattern): number {
  const steps = grid.up.length
  const firstUp = grid.up.indexOf(true)
  if (firstUp === -1) return steps * STEP_HOURS

  let longest = 0
  let current = 0
  for (let k = 0; k < steps; k++) {
    if (grid.up[(firstUp + k) % steps]) {
      current = 0
    } else {
      current += 1
      longest = Math.max(longest, current)
    }
  }
  return longest * STEP_HOURS
}
