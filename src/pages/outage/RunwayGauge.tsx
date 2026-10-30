import { BatteryMedium, Fuel, PlugZap, TriangleAlert } from 'lucide-react'
import type { TwinStep } from '../../engine/types'
import { formatDuration } from '../../lib/format'
import { isUnderServed } from './roomState'
import './RunwayGauge.css'

// Under two hours of cover the runway turns to the warning colour (DESIGN §6.2).
const WARN_BELOW_MIN = 120
// Beyond this the exact figure means little, and with almost no life-critical load the
// engine's runway grows towards billions of hours.
const CAP_MIN = 99 * 60
const EPS = 1e-9

function formatRunway(minutes: number): string {
  return minutes > CAP_MIN ? 'over 99h' : formatDuration(minutes)
}

interface RunwayGaugeProps {
  twinStep: TwinStep
  hasBattery: boolean
}

// How long the ICU can stay powered from storage at this step. Not a live region:
// the event log announces the changes, so this would only repeat them.
export function RunwayGauge({ twinStep, hasBattery }: RunwayGaugeProps) {
  const unpowered = !twinStep.gridUp && isUnderServed(twinStep, 'T1')
  // Nothing life-critical is switched on, so there is no ICU runway to speak of.
  const noLoad = !twinStep.gridUp && !unpowered && twinStep.loadKw.T1 <= EPS
  const covered = !twinStep.gridUp && !unpowered && !noLoad
  const warn = covered && twinStep.t1RunwayMin < WARN_BELOW_MIN

  return (
    <section className="runway" aria-label="ICU runway" data-level={warn ? 'warn' : undefined}>
      {/* One fixed-height slot for all three states, so the event log below never jumps. */}
      <div className="runway__main">
        {twinStep.gridUp && (
          <p className="runway__status runway__status--grid">
            <PlugZap size={24} />
            On grid power
          </p>
        )}
        {unpowered && (
          <p className="runway__status runway__status--alarm">
            <TriangleAlert size={24} />
            ICU without power
          </p>
        )}
        {noLoad && <p className="runway__status runway__status--idle">No life-critical load now</p>}
        {covered && (
          <>
            <p className="runway__label">ICU covered for</p>
            <p className="live-number live-number--runway runway__value">{formatRunway(twinStep.t1RunwayMin)}</p>
          </>
        )}
      </div>
      <p className="runway__meta">
        <span className="runway__reading">
          <BatteryMedium size={16} />
          {hasBattery ? `Battery ${Math.round(twinStep.soc * 100)}%` : 'No battery'}
        </span>
        <span className="runway__reading">
          <Fuel size={16} />
          Diesel left {Math.round(twinStep.fuelLitresLeft)} L
        </span>
      </p>
    </section>
  )
}
