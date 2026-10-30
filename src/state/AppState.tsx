import { createContext, useContext, useMemo, useReducer } from 'react'
import type { Dispatch, ReactNode } from 'react'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { runComparison } from '../engine/compare'
import type { Comparison } from '../engine/compare'
import { DEMO_SEED } from '../engine/constants'
import { computeFinance } from '../engine/finance'
import type {
  CostAssumptions,
  Equipment,
  FinanceResult,
  HospitalProfile,
  Season,
} from '../engine/types'
import { validateCosts, validateProfile } from '../engine/validate'

export interface AppStateShape {
  profile: HospitalProfile
  costs: CostAssumptions
  seed: number
  season: Season
}

export type Action =
  | { type: 'loadPreset'; presetId: string }
  | { type: 'updateProfile'; patch: Partial<Omit<HospitalProfile, 'equipment'>> }
  | { type: 'updateEquipment'; id: string; patch: Partial<Equipment> }
  | { type: 'addEquipment'; item: Equipment }
  | { type: 'removeEquipment'; id: string }
  | { type: 'updateCosts'; patch: Partial<CostAssumptions> }
  | { type: 'setSeed'; seed: number }
  | { type: 'setSeason'; season: Season }

const INITIAL_PRESET_ID = 'kano-50'

function copyEquipment(item: Equipment): Equipment {
  return { ...item, scheduleMask: [...item.scheduleMask] }
}

// Presets are shared module data. State always holds a copy so no edit can reach them.
function copyProfile(profile: HospitalProfile): HospitalProfile {
  return { ...profile, equipment: profile.equipment.map(copyEquipment) }
}

function createInitialState(): AppStateShape {
  const preset = PRESETS.find((p) => p.id === INITIAL_PRESET_ID)
  if (!preset) throw new Error(`Missing preset ${INITIAL_PRESET_ID}`)
  return {
    profile: copyProfile(preset),
    costs: { ...DEFAULT_COSTS },
    seed: DEMO_SEED,
    season: 'typical',
  }
}

function withEquipment(s: AppStateShape, equipment: Equipment[]): AppStateShape {
  return { ...s, profile: { ...s.profile, equipment } }
}

// Pure and immutable: every case returns new objects along the edited path and
// shares the rest. Costs, seed and season survive a preset swap so a user's
// finance edits are not lost when they compare hospitals.
export function reducer(s: AppStateShape, a: Action): AppStateShape {
  switch (a.type) {
    case 'loadPreset': {
      const preset = PRESETS.find((p) => p.id === a.presetId)
      return preset ? { ...s, profile: copyProfile(preset) } : s
    }
    case 'updateProfile':
      return { ...s, profile: { ...s.profile, ...a.patch } }
    case 'updateEquipment':
      return withEquipment(
        s,
        s.profile.equipment.map((e) => (e.id === a.id ? { ...e, ...a.patch } : e)),
      )
    case 'addEquipment':
      return withEquipment(s, [...s.profile.equipment, copyEquipment(a.item)])
    case 'removeEquipment':
      return withEquipment(
        s,
        s.profile.equipment.filter((e) => e.id !== a.id),
      )
    case 'updateCosts':
      return { ...s, costs: { ...s.costs, ...a.patch } }
    case 'setSeed':
      return { ...s, seed: a.seed }
    case 'setSeason':
      return { ...s, season: a.season }
  }
}

interface AppContextValue {
  state: AppStateShape
  dispatch: Dispatch<Action>
  errors: string[]
  comparison: Comparison | null
  finance: FinanceResult | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const { profile, costs, seed, season } = state

  const errors = useMemo(
    () => [...validateProfile(profile), ...validateCosts(costs)],
    [profile, costs],
  )

  // The engine only runs on valid input; pages show `errors` instead of results.
  const comparison = useMemo(
    () => (errors.length > 0 ? null : runComparison({ profile, costs, seed, season })),
    [errors, profile, costs, seed, season],
  )

  const finance = useMemo(
    () =>
      comparison
        ? computeFinance({
            baseline: comparison.baseline.metrics,
            lifeline: comparison.lifeline.metrics,
            size: comparison.size,
            costs,
          })
        : null,
    [comparison, costs],
  )

  const value = useMemo(
    () => ({ state, dispatch, errors, comparison, finance }),
    [state, errors, comparison, finance],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside <AppProvider>')
  return value
}
