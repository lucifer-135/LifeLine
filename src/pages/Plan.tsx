import { Download, TriangleAlert } from 'lucide-react'
import { DEFAULT_COSTS } from '../data/costs'
import { validateCosts, validateProfile } from '../engine/validate'
import { formatDuration } from '../lib/format'
import { useApp } from '../state/AppState'
import { AssumptionsEditor } from './plan/AssumptionsEditor'
import { FinancePanel } from './plan/FinancePanel'
import { Proposal } from './plan/Proposal'
import { SizeCards } from './plan/SizeCards'
import './Plan.css'
import '../styles/print.css'

// The alarm colour is for exactly this: life-critical equipment left without power.
function ShortfallWarning({ minutes }: { minutes: number }) {
  return (
    <div className="plan-alert plan-alert--alarm" role="alert">
      <TriangleAlert size={20} />
      <p>
        This design leaves life-critical equipment without power for {formatDuration(minutes)}. Increase battery
        or generator size.
      </p>
    </div>
  )
}

function CostErrors({ messages }: { messages: string[] }) {
  return (
    <div className="plan-alert" role="alert">
      <TriangleAlert size={20} />
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}

export function Plan() {
  const { state, dispatch, comparison, finance } = useApp()

  if (validateProfile(state.profile).length > 0) {
    return (
      <div className="container plan plan--invalid">
        <h1>Plan & finance</h1>
        <p>This hospital profile has errors, so the plan can&apos;t be sized.</p>
        <a className="button button--primary" href="#/profile">
          Fix hospital profile
        </a>
      </div>
    )
  }

  // The profile is valid, so a missing comparison means the cost assumptions are not. The
  // editor stays on the page so they can be fixed where the mistake was made.
  const costErrors = validateCosts(state.costs)
  const plan = comparison && finance ? { comparison, finance } : null
  const unpoweredMinutes = plan ? plan.comparison.lifeline.metrics.t1MinutesUnpowered : 0

  // The slots below keep their place whether or not they show, so the editor is the same
  // element before and after a cost error is fixed and does not close under the person's hands.
  return (
    <>
      <div className="container plan">
        <h1>Plan & finance</h1>

        {costErrors.length > 0 ? <CostErrors messages={costErrors} /> : null}
        {unpoweredMinutes > 0 ? <ShortfallWarning minutes={unpoweredMinutes} /> : null}

        {plan ? (
          <div className="plan__columns">
            <section className="plan__column" aria-labelledby="plan-install-title">
              <h2 id="plan-install-title">What to install</h2>
              <SizeCards
                size={plan.comparison.size}
                stateName={state.profile.state}
                worstMonth={plan.comparison.site.worstMonth}
              />
            </section>
            <section className="plan__column" aria-labelledby="plan-pays-title">
              <h2 id="plan-pays-title">Who pays what</h2>
              <FinancePanel
                finance={plan.finance}
                costs={state.costs}
                onFeeChange={(feeFraction) => dispatch({ type: 'updateCosts', patch: { feeFraction } })}
              />
            </section>
          </div>
        ) : null}

        <AssumptionsEditor
          costs={state.costs}
          onChange={(patch) => dispatch({ type: 'updateCosts', patch })}
          onReset={() => dispatch({ type: 'updateCosts', patch: DEFAULT_COSTS })}
          defaultOpen={costErrors.length > 0}
        />

        {plan ? (
          <button type="button" className="button button--primary plan__download" onClick={() => window.print()}>
            <Download size={20} />
            Download proposal
          </button>
        ) : null}
      </div>

      {plan ? (
        <Proposal
          profile={state.profile}
          season={state.season}
          costs={state.costs}
          comparison={plan.comparison}
          finance={plan.finance}
        />
      ) : null}
    </>
  )
}
