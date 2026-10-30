import { ChevronDown, RotateCcw } from 'lucide-react'
import { useId, useState } from 'react'
import { NumberField } from '../../components/NumberField'
import { SourceRef } from '../../components/SourceRef'
import { DEFAULT_COSTS } from '../../data/costs'
import { SOURCES } from '../../data/sources'
import type { CostAssumptions } from '../../engine/types'
import './AssumptionsEditor.css'

function isCostKey(key: string): key is keyof CostAssumptions {
  return key in DEFAULT_COSTS
}

// In the order of DEFAULT_COSTS, so the list reads the way the Method page does.
const COST_KEYS = Object.keys(DEFAULT_COSTS).filter(isCostKey)

// Stored as 0-1, shown and edited as 0-100.
const PERCENT_KEYS: ReadonlySet<keyof CostAssumptions> = new Set([
  'feeFraction',
  'bosFraction',
  'omFractionPerYear',
])

interface Bounds {
  min: number
  max?: number
  step?: number
}

// Everything else only has to be zero or more. These match validateCosts.
const BOUNDS: Partial<Record<keyof CostAssumptions, Bounds>> = {
  feeFraction: { min: 0, max: 100 },
  contractYears: { min: 1, max: 30, step: 1 },
}
const DEFAULT_BOUNDS: Bounds = { min: 0 }

// 0.07 * 100 is 7.000000000000001. Rounding hides that without cutting off digits a person typed.
const toPercent = (fraction: number) => Math.round(fraction * 1e6) / 1e4

function sourceFor(key: keyof CostAssumptions) {
  const source = SOURCES.find((s) => s.id === `cost.${key}`)
  if (!source) throw new Error(`AssumptionsEditor: no source with id "cost.${key}". Add it to src/data/sources.ts.`)
  return source
}

interface AssumptionsEditorProps {
  costs: CostAssumptions
  onChange: (patch: Partial<CostAssumptions>) => void
  onReset: () => void
  // Open on first show. Used when a cost error needs fixing here.
  defaultOpen?: boolean
}

export function AssumptionsEditor({ costs, onChange, onReset, defaultOpen = false }: AssumptionsEditorProps) {
  const [open, setOpen] = useState(defaultOpen)
  // A number field keeps its own draft text. Remounting them on reset clears any draft
  // the reset would otherwise leave behind, such as a box the person emptied.
  const [resetCount, setResetCount] = useState(0)
  const panelId = useId()

  function change(key: keyof CostAssumptions, entered: number) {
    onChange({ [key]: PERCENT_KEYS.has(key) ? entered / 100 : entered })
  }

  function reset() {
    onReset()
    setResetCount((count) => count + 1)
  }

  return (
    <section className="assumptions" data-open={open}>
      <h2 className="assumptions__heading">
        <button
          type="button"
          className="assumptions__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <ChevronDown size={20} className="assumptions__chevron" />
          Assumptions ({COST_KEYS.length})
        </button>
      </h2>

      {/* The grid row grows from 0fr to 1fr. While shut, `inert` keeps the fields out of the tab order. */}
      <div id={panelId} className="assumptions__panel" inert={!open}>
        <div className="assumptions__clip">
          <div className="assumptions__grid">
            {COST_KEYS.map((key) => {
              const source = sourceFor(key)
              const isPercent = PERCENT_KEYS.has(key)
              const { min, max, step } = BOUNDS[key] ?? DEFAULT_BOUNDS
              return (
                <div className="assumption" key={`${key}-${resetCount}`}>
                  <NumberField
                    label={source.label}
                    value={isPercent ? toPercent(costs[key]) : costs[key]}
                    onChange={(entered) => change(key, entered)}
                    min={min}
                    max={max}
                    step={step}
                    suffix={isPercent ? `% ${source.unit}` : source.unit}
                  />
                  <span className="assumption__meta">
                    {source.isEstimate ? <span className="assumption__tag">Estimate</span> : null}
                    <SourceRef id={source.id} />
                  </span>
                </div>
              )
            })}
          </div>
          <button type="button" className="button button--secondary assumptions__reset" onClick={reset}>
            <RotateCcw size={16} />
            Reset to defaults
          </button>
        </div>
      </div>
    </section>
  )
}
