import { useState } from 'react'
import { SegmentedControl } from '../components/SegmentedControl'
import type { Comparison } from '../engine/compare'
import { STEPS_PER_DAY } from '../engine/constants'
import { stepToClock } from '../engine/events'
import type { Scenario, Season } from '../engine/types'
import { validateProfile } from '../engine/validate'
import { useApp } from '../state/AppState'
import { useHashRoute } from '../state/useHashRoute'
import { usePlayback } from '../state/usePlayback'
import { ComparisonPanel } from './outage/ComparisonPanel'
import { EventLog } from './outage/EventLog'
import { HospitalMap } from './outage/HospitalMap'
import { LoadChart } from './outage/LoadChart'
import { PlaybackBar } from './outage/PlaybackBar'
import { RunwayGauge } from './outage/RunwayGauge'
import './OutageDay.css'

const LAST_STEP = STEPS_PER_DAY - 1
const MAX_SEED = 1_000_000

const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: 'typical', label: 'Typical day' },
  { value: 'worst', label: 'Rainy season' },
]

const SCENARIO_OPTIONS: { value: Scenario; label: string }[] = [
  { value: 'lifeline', label: 'With Lifeline' },
  { value: 'baseline', label: 'Today: diesel only' },
]

// A different day of outages: any positive seed except the one on screen.
function nextSeed(current: number): number {
  let seed = current
  while (seed === current) seed = Math.floor(Math.random() * MAX_SEED) + 1
  return seed
}

// The day itself. It only mounts with a valid comparison, so an invalid profile never
// starts the playback timer.
function OutageTwin({ comparison }: { comparison: Comparison }) {
  const { state, dispatch } = useApp()
  const { params } = useHashRoute()
  // A new hospital or a new day starts again from 00:00; the season keeps the time.
  const playback = usePlayback({
    totalSteps: STEPS_PER_DAY,
    resetKey: `${state.profile.id}:${state.seed}`,
    autoplay: params.get('autoplay') === '1',
  })
  const [scenario, setScenario] = useState<Scenario>('lifeline')

  const { step } = playback
  const result = comparison[scenario]
  const twinStep = result.steps[step]

  return (
    <div className="container outage">
      <header className="outage__header">
        <div className="outage__title-row">
          <h1>Outage day</h1>
          <p className="outage__clock live-number live-number--clock">
            <span className="visually-hidden">Time </span>
            <time dateTime={stepToClock(step)}>{stepToClock(step)}</time>
          </p>
        </div>
        <div className="outage__controls">
          <SegmentedControl
            label="Season"
            options={SEASON_OPTIONS}
            value={state.season}
            onChange={(season) => dispatch({ type: 'setSeason', season })}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={() => dispatch({ type: 'setSeed', seed: nextSeed(state.seed) })}
          >
            New day
          </button>
          <SegmentedControl label="Scenario" options={SCENARIO_OPTIONS} value={scenario} onChange={setScenario} />
        </div>
      </header>

      <div className="outage__twin">
        <div className="outage__map">
          <HospitalMap profile={state.profile} result={result} step={step} pvKwp={comparison.size.pvKwp} />
        </div>
        <div className="outage__runway">
          <RunwayGauge twinStep={twinStep} hasBattery={scenario === 'lifeline'} />
        </div>
        <div className="outage__log">
          <EventLog events={result.events} step={step} />
        </div>
      </div>

      <div className="outage__timeline">
        <LoadChart result={result} step={step} />
      </div>

      <ComparisonPanel
        baseline={comparison.baseline}
        lifeline={comparison.lifeline}
        step={step}
        dayEnded={step === LAST_STEP}
        costs={state.costs}
      />

      {/* Last in the page so it stays docked at the bottom of the screen all the way down. */}
      <div className="outage__dock">
        <PlaybackBar playback={playback} lastStep={LAST_STEP} />
      </div>
    </div>
  )
}

export function OutageDay() {
  const { state, comparison } = useApp()

  if (!comparison) {
    // A valid profile with no comparison means the cost assumptions are the problem, and
    // they are edited on the plan page, not the profile page.
    if (validateProfile(state.profile).length === 0) {
      return (
        <div className="container outage outage--invalid">
          <h1>Outage day</h1>
          <p>The cost assumptions have errors, so the outage day can&apos;t run.</p>
          <a className="button button--primary" href="#/plan">
            Fix cost assumptions
          </a>
        </div>
      )
    }
    return (
      <div className="container outage outage--invalid">
        <h1>Outage day</h1>
        <p>This hospital profile has errors, so the outage day can&apos;t run.</p>
        <a className="button button--primary" href="#/profile">
          Fix hospital profile
        </a>
      </div>
    )
  }

  return <OutageTwin comparison={comparison} />
}
