import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { CountUp } from '../../components/CountUp'
import { partialMetrics } from '../../engine/twin'
import type { CostAssumptions, TwinMetrics, TwinResult } from '../../engine/types'
import { formatDuration, formatKg, formatLitres, formatNgn } from '../../lib/format'
import './ComparisonPanel.css'

// Short, so the totals keep up with playback at 16× (a step every 25 ms).
const COUNT_MS = 300
// --dur-base with --ease-out, for the verdict.
const FADE_IN = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const

interface ColumnProps {
  modifier: 'baseline' | 'lifeline'
  title: string
  metrics: TwinMetrics
}

function ComparisonColumn({ modifier, title, metrics }: ColumnProps) {
  const unpowered = metrics.t1MinutesUnpowered
  return (
    <div className={`comparison__column comparison__column--${modifier}`}>
      <h3>{title}</h3>
      <dl className="comparison__rows">
        <div className="comparison__row comparison__row--lead">
          <dt>Life-critical without power</dt>
          <dd
            className={`live-number live-number--comparison comparison__value ${
              unpowered > 0 ? 'comparison__value--alarm' : 'comparison__value--lit'
            }`}
          >
            <CountUp value={unpowered} format={formatDuration} durationMs={COUNT_MS} />
          </dd>
        </div>
        <div className="comparison__row">
          <dt>Diesel burned</dt>
          <dd className="live-number comparison__value">
            <CountUp value={metrics.dieselLitres} format={formatLitres} durationMs={COUNT_MS} />
          </dd>
        </div>
        <div className="comparison__row">
          <dt>Energy cost</dt>
          <dd className="live-number comparison__value">
            <CountUp value={metrics.energyCostNgn} format={formatNgn} durationMs={COUNT_MS} />
          </dd>
        </div>
        <div className="comparison__row">
          <dt>CO₂</dt>
          <dd className="live-number comparison__value">
            <CountUp value={metrics.co2Kg} format={formatKg} durationMs={COUNT_MS} />
          </dd>
        </div>
      </dl>
    </div>
  )
}

// The end-of-day line (DESIGN §6.2). It always uses the full-day totals.
function Verdict({ baseline, lifeline }: { baseline: TwinMetrics; lifeline: TwinMetrics }) {
  const reduceMotion = useReducedMotion() === true
  const saving = baseline.energyCostNgn - lifeline.energyCostNgn

  return (
    <motion.p
      className="comparison__verdict"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={FADE_IN}
    >
      {lifeline.t1MinutesUnpowered === 0 ? (
        <>
          Today, life-critical equipment went {formatDuration(baseline.t1MinutesUnpowered)} without power. With
          Lifeline: 0 minutes.
          {saving > 0 && ` Lifeline would also save ${formatNgn(saving)} today.`}
        </>
      ) : (
        <>
          With Lifeline, life-critical equipment still went {formatDuration(lifeline.t1MinutesUnpowered)} without
          power. Increase battery or generator size on the <a href="#/plan">plan page</a>.
        </>
      )}
    </motion.p>
  )
}

interface ComparisonPanelProps {
  baseline: TwinResult
  lifeline: TwinResult
  step: number
  dayEnded: boolean
  costs: CostAssumptions
}

// Both scenarios side by side, whichever one the map is showing. The totals cover the
// day so far, so they count up as the day plays.
export function ComparisonPanel({ baseline, lifeline, step, dayEnded, costs }: ComparisonPanelProps) {
  const baselineSoFar = useMemo(() => partialMetrics(baseline, step, costs), [baseline, step, costs])
  const lifelineSoFar = useMemo(() => partialMetrics(lifeline, step, costs), [lifeline, step, costs])

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <h2 id="comparison-title">Comparison</h2>
      <div className="comparison__columns">
        <ComparisonColumn modifier="baseline" title="Today: diesel only" metrics={baselineSoFar} />
        <ComparisonColumn modifier="lifeline" title="With Lifeline" metrics={lifelineSoFar} />
      </div>
      {dayEnded && <Verdict baseline={baseline.metrics} lifeline={lifeline.metrics} />}
    </section>
  )
}
