import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { DEMO_SEED } from '../engine/constants'
import { computeFinance } from '../engine/finance'
import type { Equipment, HospitalProfile } from '../engine/types'
import { AppProvider, reducer, useApp } from './AppState'
import type { AppStateShape } from './AppState'

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

function equipmentById(profile: HospitalProfile, id: string): Equipment {
  const item = profile.equipment.find((e) => e.id === id)
  if (!item) throw new Error(`Missing equipment ${id}`)
  return item
}

// Freezing makes any in-place write by the reducer throw (modules run in strict
// mode), so "immutable" is enforced rather than inferred from before/after equality.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

// A state the reducer built itself, so it owns its profile and can be frozen
// without freezing the shared PRESETS.
function frozenKanoState(): AppStateShape {
  const base: AppStateShape = {
    profile: presetById('phc'),
    costs: { ...DEFAULT_COSTS },
    seed: DEMO_SEED,
    season: 'typical',
  }
  return deepFreeze(reducer(base, { type: 'loadPreset', presetId: 'kano-50' }))
}

const extraItem: Equipment = {
  id: 'test-pump',
  name: 'Test pump',
  ward: 'Utilities',
  ratedW: 300,
  dutyCycle: 0.5,
  scheduleMask: Array.from({ length: 24 }, () => true),
  tier: 'T2',
  qty: 2,
}

function renderApp() {
  return renderHook(() => useApp(), { wrapper: AppProvider })
}

describe('AppProvider initial state', () => {
  test('initial state is kano-50, DEMO_SEED, typical', () => {
    const { result } = renderApp()
    const { state, errors, comparison, finance } = result.current
    expect(state.profile.id).toBe('kano-50')
    expect(state.costs).toEqual(DEFAULT_COSTS)
    expect(state.seed).toBe(DEMO_SEED)
    expect(state.season).toBe('typical')
    expect(errors).toEqual([])
    expect(comparison).not.toBeNull()
    expect(finance).not.toBeNull()
  })

  test('the starting profile is a copy, not the shared preset', () => {
    const { result } = renderApp()
    const preset = presetById('kano-50')
    expect(result.current.state.profile).not.toBe(preset)
    expect(result.current.state.profile.equipment).not.toBe(preset.equipment)
  })

  test('useApp outside the provider throws a clear error', () => {
    // React logs the thrown render error; keep the test output clean.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => renderHook(() => useApp())).toThrow('useApp must be used inside <AppProvider>')
    } finally {
      consoleError.mockRestore()
    }
  })
})

describe('reducer', () => {
  test('loadPreset phc swaps profile and keeps costs', () => {
    const edited = reducer(frozenKanoState(), { type: 'updateCosts', patch: { dieselNgnPerLitre: 1500 } })
    const next = reducer(edited, { type: 'loadPreset', presetId: 'phc' })
    expect(next.profile.id).toBe('phc')
    expect(next.profile).toEqual(presetById('phc'))
    expect(next.costs).toEqual({ ...DEFAULT_COSTS, dieselNgnPerLitre: 1500 })
    expect(next.seed).toBe(edited.seed)
    expect(next.season).toBe(edited.season)
  })

  test('loadPreset copies the preset so later edits cannot reach it', () => {
    const preset = presetById('phc')
    const before = structuredClone(preset)
    const next = reducer(frozenKanoState(), { type: 'loadPreset', presetId: 'phc' })
    expect(next.profile).not.toBe(preset)
    expect(next.profile.equipment).not.toBe(preset.equipment)
    expect(next.profile.equipment[0]).not.toBe(preset.equipment[0])
    expect(next.profile.equipment[0].scheduleMask).not.toBe(preset.equipment[0].scheduleMask)
    expect(preset).toEqual(before)
  })

  test('loadPreset with an unknown id returns the state unchanged', () => {
    const state = frozenKanoState()
    expect(reducer(state, { type: 'loadPreset', presetId: 'nope' })).toBe(state)
  })

  test('updateProfile patches profile fields and leaves equipment alone', () => {
    const state = frozenKanoState()
    const next = reducer(state, {
      type: 'updateProfile',
      patch: { gridHoursPerDay: 10, dieselLitresPerMonth: 900 },
    })
    expect(next.profile.gridHoursPerDay).toBe(10)
    expect(next.profile.dieselLitresPerMonth).toBe(900)
    expect(next.profile.equipment).toBe(state.profile.equipment)
    expect(state.profile.gridHoursPerDay).toBe(6)
  })

  test('updateEquipment changes qty immutably', () => {
    const preset = presetById('kano-50')
    const presetBefore = structuredClone(preset)
    const state = frozenKanoState()
    const ventilator = equipmentById(state.profile, 'icu-ventilator')
    expect(ventilator.qty).toBe(4)

    const next = reducer(state, { type: 'updateEquipment', id: 'icu-ventilator', patch: { qty: 9 } })

    expect(equipmentById(next.profile, 'icu-ventilator').qty).toBe(9)
    // Prior state and the shared preset are untouched.
    expect(ventilator.qty).toBe(4)
    expect(equipmentById(preset, 'icu-ventilator').qty).toBe(4)
    expect(preset).toEqual(presetBefore)
    // Only the edited row is new; the others are shared with the old state.
    expect(next).not.toBe(state)
    expect(next.profile.equipment).not.toBe(state.profile.equipment)
    expect(equipmentById(next.profile, 'patient-monitor')).toBe(equipmentById(state.profile, 'patient-monitor'))
  })

  test('updateEquipment with an unknown id changes no row', () => {
    const state = frozenKanoState()
    const next = reducer(state, { type: 'updateEquipment', id: 'nope', patch: { qty: 99 } })
    expect(next.profile.equipment).toEqual(state.profile.equipment)
  })

  test('addEquipment appends a copy of the item', () => {
    const state = frozenKanoState()
    const next = reducer(state, { type: 'addEquipment', item: extraItem })
    expect(next.profile.equipment).toHaveLength(state.profile.equipment.length + 1)
    const added = next.profile.equipment[next.profile.equipment.length - 1]
    expect(added).toEqual(extraItem)
    expect(added).not.toBe(extraItem)
    expect(added.scheduleMask).not.toBe(extraItem.scheduleMask)
    expect(state.profile.equipment.some((e) => e.id === 'test-pump')).toBe(false)
  })

  test('removeEquipment drops only the matching row', () => {
    const state = frozenKanoState()
    const next = reducer(state, { type: 'removeEquipment', id: 'security-lighting' })
    expect(next.profile.equipment).toHaveLength(state.profile.equipment.length - 1)
    expect(next.profile.equipment.some((e) => e.id === 'security-lighting')).toBe(false)
    expect(state.profile.equipment.some((e) => e.id === 'security-lighting')).toBe(true)
  })

  test('updateCosts merges the patch into costs', () => {
    const state = frozenKanoState()
    const next = reducer(state, { type: 'updateCosts', patch: { feeFraction: 0.6 } })
    expect(next.costs).toEqual({ ...DEFAULT_COSTS, feeFraction: 0.6 })
    expect(state.costs).toEqual(DEFAULT_COSTS)
  })

  test('setSeed and setSeason replace only their field', () => {
    const state = frozenKanoState()
    const reseeded = reducer(state, { type: 'setSeed', seed: 7 })
    expect(reseeded).toEqual({ ...state, seed: 7 })
    const rainy = reducer(state, { type: 'setSeason', season: 'worst' })
    expect(rainy).toEqual({ ...state, season: 'worst' })
  })
})

describe('derived results', () => {
  test('invalid profile → comparison null, errors listed', () => {
    const { result } = renderApp()
    const lifeCriticalIds = result.current.state.profile.equipment
      .filter((e) => e.tier === 'T1')
      .map((e) => e.id)
    expect(lifeCriticalIds.length).toBeGreaterThan(0)

    act(() => {
      for (const id of lifeCriticalIds) result.current.dispatch({ type: 'removeEquipment', id })
    })

    expect(result.current.errors).toContain('Add at least one life-critical item.')
    expect(result.current.comparison).toBeNull()
    expect(result.current.finance).toBeNull()
  })

  test('invalid costs → comparison null, errors listed', () => {
    const { result } = renderApp()
    act(() => {
      result.current.dispatch({ type: 'updateCosts', patch: { feeFraction: 2 } })
    })
    expect(result.current.errors).toContain("Fee must be between 0% and 100% of today's spend.")
    expect(result.current.comparison).toBeNull()
    expect(result.current.finance).toBeNull()
  })

  test('fixing the input brings the results back', () => {
    const { result } = renderApp()
    act(() => {
      result.current.dispatch({ type: 'updateCosts', patch: { feeFraction: 2 } })
    })
    expect(result.current.comparison).toBeNull()
    act(() => {
      result.current.dispatch({ type: 'updateCosts', patch: { feeFraction: DEFAULT_COSTS.feeFraction } })
    })
    expect(result.current.errors).toEqual([])
    expect(result.current.comparison).not.toBeNull()
    expect(result.current.finance).not.toBeNull()
  })

  test('comparison reruns when an input changes and is reused when none does', () => {
    const { result, rerender } = renderApp()
    const first = result.current.comparison
    rerender()
    expect(result.current.comparison).toBe(first)

    act(() => {
      result.current.dispatch({ type: 'setSeason', season: 'worst' })
    })
    expect(result.current.comparison).not.toBe(first)
    expect(result.current.comparison?.lifeline.steps).toHaveLength(96)
  })

  test('finance is computed from the same comparison the outage day shows', () => {
    const { result } = renderApp()
    const { comparison, finance, state } = result.current
    if (!comparison || !finance) throw new Error('Expected results for a valid hospital')
    expect(finance).toEqual(
      computeFinance({
        baseline: comparison.baseline.metrics,
        lifeline: comparison.lifeline.metrics,
        size: comparison.size,
        costs: state.costs,
      }),
    )
  })
})
