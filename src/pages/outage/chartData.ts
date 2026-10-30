import { STEPS_PER_DAY } from '../../engine/constants'
import { stepToClock } from '../../engine/events'
import type { TwinResult, TwinStep } from '../../engine/types'
import { formatDuration } from '../../lib/format'

// Data shaping for LoadChart, kept out of the component so each piece is computed
// once per day and only the reveal changes with the step.

const STEPS_PER_HOUR = STEPS_PER_DAY / 24

// One chart point per step, plotted at the step's midpoint (x = step + 0.5), so the
// x axis runs from 0 to 96 and an hour starts at a multiple of 4.
export interface ChartPoint {
  x: number
  lifeCritical: number | null
  essential: number | null
  canWait: number | null
  solar: number | null
  battery: number | null
  generator: number | null
}

export function chartPoints(result: TwinResult): ChartPoint[] {
  return result.steps.map((s, i) => ({
    x: i + 0.5,
    lifeCritical: s.servedKw.T1,
    essential: s.servedKw.T2,
    canWait: s.servedKw.T3,
    solar: s.pvKw,
    battery: s.soc * 100,
    generator: s.dieselKw,
  }))
}

// The same x with no values: Recharts draws nothing there, which is how the day
// is revealed up to the current step.
export function hiddenPoints(points: ChartPoint[]): ChartPoint[] {
  return points.map(({ x }) => ({
    x,
    lifeCritical: null,
    essential: null,
    canWait: null,
    solar: null,
    battery: null,
    generator: null,
  }))
}

export function revealUpTo(points: ChartPoint[], hidden: ChartPoint[], step: number): ChartPoint[] {
  return points.map((point, i) => (i <= step ? point : hidden[i]))
}

// Round tick spacings for the kW axis, smallest first.
const KW_TICK_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
const MAX_KW_TICK_GAPS = 5

// Ticks for the kW axis, fixed for the whole day: 0 up to a round number at or above the
// day's highest value. Recharts would otherwise size the axis to the part revealed so
// far, and the chart would rescale while it plays.
export function kwAxisTicks(result: TwinResult): number[] {
  const highest = result.steps.reduce(
    (max, s) => Math.max(max, s.servedKw.T1 + s.servedKw.T2 + s.servedKw.T3, s.pvKw, s.dieselKw),
    0,
  )
  const step =
    KW_TICK_STEPS.find((candidate) => highest / candidate <= MAX_KW_TICK_GAPS) ??
    KW_TICK_STEPS[KW_TICK_STEPS.length - 1]
  const top = Math.max(step, Math.ceil(highest / step) * step)
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

// A run of steps, from `start` up to but not including `end`, in x-axis units.
export interface StepRun {
  start: number
  end: number
}

function runsWhere(steps: TwinStep[], test: (step: TwinStep) => boolean): StepRun[] {
  const runs: StepRun[] = []
  steps.forEach((step, i) => {
    if (!test(step)) return
    const last = runs[runs.length - 1]
    if (last && last.end === i) last.end = i + 1
    else runs.push({ start: i, end: i + 1 })
  })
  return runs
}

export const gridUpRuns = (steps: TwinStep[]) => runsWhere(steps, (step) => step.gridUp)
export const gridDownRuns = (steps: TwinStep[]) => runsWhere(steps, (step) => !step.gridUp)

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

// The chart's aria-label (DESIGN §9). It describes the whole day, not the part played.
export function chartSummary(result: TwinResult): string {
  const outages = gridDownRuns(result.steps)
  const downSteps = outages.reduce((sum, run) => sum + run.end - run.start, 0)
  const hours = Math.round((downSteps / STEPS_PER_HOUR) * 100) / 100
  const unpowered = result.metrics.t1MinutesUnpowered
  const lifeCritical =
    unpowered > 0
      ? `Life-critical load unserved for ${formatDuration(unpowered)}.`
      : 'Life-critical load served all day.'
  return `Load through the day. Grid off for ${plural(hours, 'hour', 'hours')} in ${plural(
    outages.length,
    'block',
    'blocks',
  )}. ${lifeCritical}`
}

// Hourly averages for the chart's data table.
export interface HourRow {
  time: string
  lifeCritical: number
  essential: number
  canWait: number
  solar: number
  battery: number
  generator: number
}

function average(steps: TwinStep[], value: (step: TwinStep) => number): number {
  return steps.reduce((sum, step) => sum + value(step), 0) / steps.length
}

export function hourlyRows(result: TwinResult): HourRow[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const steps = result.steps.slice(hour * STEPS_PER_HOUR, (hour + 1) * STEPS_PER_HOUR)
    return {
      time: stepToClock(hour * STEPS_PER_HOUR),
      lifeCritical: average(steps, (s) => s.servedKw.T1),
      essential: average(steps, (s) => s.servedKw.T2),
      canWait: average(steps, (s) => s.servedKw.T3),
      solar: average(steps, (s) => s.pvKw),
      battery: average(steps, (s) => s.soc * 100),
      generator: average(steps, (s) => s.dieselKw),
    }
  })
}
