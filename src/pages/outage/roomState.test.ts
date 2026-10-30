import { describe, expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../../data/costs'
import { PRESETS } from '../../data/presets'
import { runComparison } from '../../engine/compare'
import { DEMO_SEED } from '../../engine/constants'
import type {
  Equipment,
  HospitalProfile,
  Tier,
  TierKw,
  TwinResult,
  TwinStep,
  Ward,
} from '../../engine/types'
import { hasEquipment, roomState } from './roomState'

// --- hand-built fixtures ---

const ALL_DAY = Array<boolean>(24).fill(true)

function hours(from: number, to: number): boolean[] {
  return Array.from({ length: 24 }, (_, hour) => hour >= from && hour < to)
}

function item(ward: Ward, tier: Tier, over: Partial<Equipment> = {}): Equipment {
  return {
    id: `${ward}-${tier}`,
    name: `${ward} ${tier}`,
    ward,
    ratedW: 100,
    dutyCycle: 1,
    scheduleMask: ALL_DAY,
    tier,
    qty: 1,
    ...over,
  }
}

function profileOf(...equipment: Equipment[]): HospitalProfile {
  return {
    id: 'test',
    name: 'Test hospital',
    state: 'Kano',
    beds: 10,
    equipment,
    gridHoursPerDay: 6,
    dieselLitresPerMonth: 1000,
    generatorKva: 30,
  }
}

const FULL: TierKw = { T1: 1, T2: 1, T3: 1 }

function twinStep(t: number, over: Partial<TwinStep> = {}): TwinStep {
  return {
    t,
    gridUp: false,
    loadKw: FULL,
    servedKw: FULL,
    shedT2: false,
    shedT3: false,
    pvKw: 0,
    pvUsedKw: 0,
    curtailedKw: 0,
    gridKw: 0,
    chargeKw: 0,
    dischargeKw: 0,
    dieselKw: 0,
    soc: 0.5,
    fuelLitresLeft: 10,
    t1RunwayMin: 60,
    ...over,
  }
}

// A healthy 96-step day with `over` applied to the one step under test.
function resultWith(step: number, over: Partial<TwinStep>): TwinResult {
  return {
    scenario: 'lifeline',
    steps: Array.from({ length: 96 }, (_, t) => twinStep(t, t === step ? over : {})),
    events: [],
    metrics: {
      t1MinutesUnpowered: 0,
      t2MinutesUnpowered: 0,
      dieselLitres: 0,
      gridKwh: 0,
      energyCostNgn: 0,
      co2Kg: 0,
    },
  }
}

const STEP = 40 // 10:00

// --- brief test ---

describe('roomState', () => {
  test('ICU alarm when T1 unserved; dark when all shed; lit otherwise', () => {
    const icu = profileOf(item('ICU', 'T1'), item('Lab', 'T3'))

    const t1Short = resultWith(STEP, { servedKw: { T1: 0.4, T2: 1, T3: 1 } })
    expect(roomState('ICU', STEP, t1Short, icu)).toBe('alarm')

    const t3Shed = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
    expect(roomState('Lab', STEP, t3Shed, icu)).toBe('dark')

    expect(roomState('ICU', STEP, resultWith(STEP, {}), icu)).toBe('lit')
    expect(roomState('Lab', STEP, resultWith(STEP, {}), icu)).toBe('lit')
  })

  // --- alarm ---

  describe('alarm', () => {
    test('T1 under-served in a ward with an active T1 item', () => {
      const profile = profileOf(item('ICU', 'T1'), item('ICU', 'T2'))
      const result = resultWith(STEP, { servedKw: { T1: 0, T2: 0, T3: 0 } })
      expect(roomState('ICU', STEP, result, profile)).toBe('alarm')
    })

    test('alarm wins over a shed lower tier in the same ward', () => {
      const profile = profileOf(item('ICU', 'T1'), item('ICU', 'T3'))
      const result = resultWith(STEP, {
        shedT3: true,
        servedKw: { T1: 0.5, T2: 1, T3: 0 },
      })
      expect(roomState('ICU', STEP, result, profile)).toBe('alarm')
    })

    test('a ward with no T1 item is never in alarm', () => {
      const profile = profileOf(item('Admin', 'T3'))
      const result = resultWith(STEP, { servedKw: { T1: 0, T2: 1, T3: 1 } })
      expect(roomState('Admin', STEP, result, profile)).toBe('lit')
    })

    test('a T1 item that is off by its schedule does not raise the alarm', () => {
      const profile = profileOf(item('Theatre', 'T1', { scheduleMask: hours(8, 16) }))
      const result = resultWith(8, { servedKw: { T1: 0, T2: 1, T3: 1 } })
      // No alarm; the idle room is dark only because the hospital's life-critical supply failed.
      expect(roomState('Theatre', 8, result, profile)).not.toBe('alarm')
      expect(roomState('Theatre', 8, result, profile)).toBe('dark')
    })

    test('T1 shortfall of 1e-9 or less is rounding, not an alarm', () => {
      const profile = profileOf(item('ICU', 'T1'))
      const result = resultWith(STEP, { servedKw: { T1: 1 - 1e-12, T2: 1, T3: 1 } })
      expect(roomState('ICU', STEP, result, profile)).toBe('lit')
    })
  })

  // --- dark, dim, lit ---

  describe('dark, dim and lit', () => {
    const wards = profileOf(
      item('Wards', 'T2'),
      item('Wards', 'T3'),
      item('Maternity', 'T2'),
      item('Lab', 'T3'),
    )

    test('dim when only T3 is shed in a ward with T2 and T3', () => {
      const result = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      expect(roomState('Wards', STEP, result, wards)).toBe('dim')
    })

    test('dark when T2 and T3 are both shed in a ward with only those tiers', () => {
      const result = resultWith(STEP, {
        shedT2: true,
        shedT3: true,
        servedKw: { T1: 1, T2: 0, T3: 0 },
      })
      expect(roomState('Wards', STEP, result, wards)).toBe('dark')
    })

    test('dark when the one tier in the ward is shed', () => {
      const result = resultWith(STEP, { shedT2: true, servedKw: { T1: 1, T2: 0, T3: 1 } })
      expect(roomState('Maternity', STEP, result, wards)).toBe('dark')
      expect(roomState('Lab', STEP, result, wards)).toBe('lit')
    })

    test('lit when nothing is shed or under-served', () => {
      expect(roomState('Wards', STEP, resultWith(STEP, {}), wards)).toBe('lit')
    })

    test('T3 under-served with no shed flag counts as off', () => {
      const result = resultWith(STEP, { servedKw: { T1: 1, T2: 1, T3: 0.2 } })
      expect(roomState('Wards', STEP, result, wards)).toBe('dim')
      expect(roomState('Lab', STEP, result, wards)).toBe('dark')
    })

    test('baseline style: under-served T2 with no shed flag counts as off', () => {
      const result = resultWith(STEP, {
        shedT2: false,
        shedT3: false,
        servedKw: { T1: 1, T2: 0, T3: 0 },
      })
      expect(roomState('Maternity', STEP, result, wards)).toBe('dark')
      expect(roomState('Wards', STEP, result, wards)).toBe('dark')
    })

    test('a shed flag counts as off even when the served kW still equals the load', () => {
      const result = resultWith(STEP, { shedT3: true })
      expect(roomState('Lab', STEP, result, wards)).toBe('dark')
    })

    test('a tier with zero load is not under-served', () => {
      const result = resultWith(STEP, {
        loadKw: { T1: 1, T2: 0, T3: 1 },
        servedKw: { T1: 1, T2: 0, T3: 1 },
      })
      expect(roomState('Maternity', STEP, result, wards)).toBe('lit')
    })
  })

  // --- schedule and quantity ---

  describe('active items only', () => {
    test('an item that is off by its schedule is ignored', () => {
      const profile = profileOf(
        item('Theatre', 'T2', { scheduleMask: hours(8, 16) }),
        item('ICU', 'T1'),
      )
      const result = resultWith(8, { shedT2: true, servedKw: { T1: 1, T2: 0, T3: 1 } })

      // 02:00: the theatre equipment is switched off, so the shed T2 tier is irrelevant.
      expect(roomState('Theatre', 8, result, profile)).toBe('lit')
      // 10:00: it is active, and T2 is shed.
      const daytime = resultWith(STEP, { shedT2: true, servedKw: { T1: 1, T2: 0, T3: 1 } })
      expect(roomState('Theatre', STEP, daytime, profile)).toBe('dark')
    })

    test('the schedule hour comes from the step, four steps per hour', () => {
      const profile = profileOf(item('Lab', 'T3', { scheduleMask: hours(10, 11) }))
      const shed = { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } }
      expect(roomState('Lab', 39, resultWith(39, shed), profile)).toBe('lit')
      expect(roomState('Lab', 40, resultWith(40, shed), profile)).toBe('dark')
      expect(roomState('Lab', 43, resultWith(43, shed), profile)).toBe('dark')
      expect(roomState('Lab', 44, resultWith(44, shed), profile)).toBe('lit')
    })

    test('an inactive item does not dilute the ward: dark stays dark', () => {
      const profile = profileOf(
        item('Wards', 'T3'),
        item('Wards', 'T2', { scheduleMask: hours(0, 6) }),
      )
      const result = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      expect(roomState('Wards', STEP, result, profile)).toBe('dark')
    })

    test('items with qty 0 are ignored', () => {
      const profile = profileOf(item('Lab', 'T3', { qty: 0 }), item('Lab', 'T2'))
      const result = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      expect(roomState('Lab', STEP, result, profile)).toBe('lit')
    })

    // A room with nothing switched on has no load of its own, so its light shows whether
    // the hospital has power: life-critical load served means the supply is there.
    test('a ward with no active items is lit while life-critical load is served', () => {
      const profile = profileOf(item('Lab', 'T3', { scheduleMask: hours(8, 9) }))
      const result = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      expect(roomState('Lab', STEP, result, profile)).toBe('lit')
      expect(roomState('Admin', STEP, result, profile)).toBe('lit')
    })

    test('a ward with no active items is dark while life-critical load is under-served', () => {
      const profile = profileOf(item('Lab', 'T3', { scheduleMask: hours(8, 9) }))
      const blackout = resultWith(STEP, { servedKw: { T1: 0, T2: 0, T3: 0 } })
      expect(roomState('Lab', STEP, blackout, profile)).toBe('dark')
      expect(roomState('Admin', STEP, blackout, profile)).toBe('dark')

      const partial = resultWith(STEP, { servedKw: { T1: 0.5, T2: 1, T3: 1 } })
      expect(roomState('Lab', STEP, partial, profile)).toBe('dark')
    })
  })

  // --- merged rooms ---

  describe('merged wards', () => {
    const profile = profileOf(item('Wards', 'T2'), item('Utilities', 'T3'), item('Lab', 'T3'))

    test('Wards and Utilities are judged together', () => {
      const t3Shed = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      expect(roomState(['Wards', 'Utilities'], STEP, t3Shed, profile)).toBe('dim')

      const bothShed = resultWith(STEP, {
        shedT2: true,
        shedT3: true,
        servedKw: { T1: 1, T2: 0, T3: 0 },
      })
      expect(roomState(['Wards', 'Utilities'], STEP, bothShed, profile)).toBe('dark')

      expect(roomState(['Wards', 'Utilities'], STEP, resultWith(STEP, {}), profile)).toBe('lit')
    })

    test('items from other wards are not included', () => {
      const t3Shed = resultWith(STEP, { shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
      // Only Utilities (T3) and Wards (T2) count; Lab (T3) is outside the merge.
      expect(roomState(['Wards', 'Utilities'], STEP, t3Shed, profile)).toBe('dim')
      expect(roomState('Wards', STEP, t3Shed, profile)).toBe('lit')
      expect(roomState('Utilities', STEP, t3Shed, profile)).toBe('dark')
    })

    test('a T1 item in either ward can raise the alarm', () => {
      const withT1 = profileOf(item('Wards', 'T2'), item('Utilities', 'T1'))
      const result = resultWith(STEP, { servedKw: { T1: 0, T2: 1, T3: 1 } })
      expect(roomState(['Wards', 'Utilities'], STEP, result, withT1)).toBe('alarm')
    })
  })

  // --- real engine output ---

  describe('with the engine', () => {
    const kano = PRESETS.find((p) => p.id === 'kano-50')
    if (!kano) throw new Error('Missing preset kano-50')
    const { baseline, lifeline } = runComparison({
      profile: kano,
      costs: DEFAULT_COSTS,
      seed: DEMO_SEED,
      season: 'typical',
    })
    const rooms = [...new Set(kano.equipment.map((e) => e.ward))]
    const stateAt = (result: TwinResult, step: number, ward: Ward) =>
      roomState(ward, step, result, kano)

    test('Lifeline never puts a ward in alarm (life-critical load is never shed)', () => {
      const alarms = rooms.flatMap((ward) =>
        lifeline.steps
          .map((_, step) => (stateAt(lifeline, step, ward) === 'alarm' ? `${ward}@${step}` : ''))
          .filter(Boolean),
      )
      expect(alarms).toEqual([])
    })

    test('the baseline day has an ICU alarm exactly when its T1 load goes unserved', () => {
      expect(baseline.metrics.t1MinutesUnpowered).toBeGreaterThan(0)
      baseline.steps.forEach((s, step) => {
        const t1Short = s.servedKw.T1 < s.loadKw.T1 - 1e-9
        expect(stateAt(baseline, step, 'ICU') === 'alarm').toBe(t1Short)
      })
    })

    test('no ward is lit in the baseline while its life-critical load goes unserved', () => {
      const blackoutSteps = baseline.steps.flatMap((s, step) => (s.servedKw.T1 < s.loadKw.T1 - 1e-9 ? [step] : []))
      expect(blackoutSteps.length).toBeGreaterThan(0)
      const lit = blackoutSteps.flatMap((step) =>
        rooms.filter((ward) => stateAt(baseline, step, ward) === 'lit').map((ward) => `${ward}@${step}`),
      )
      expect(lit).toEqual([])
    })

    test('every ward is lit while the grid is up', () => {
      for (const [step, s] of baseline.steps.entries()) {
        if (!s.gridUp) continue
        for (const ward of rooms) expect(stateAt(baseline, step, ward)).toBe('lit')
      }
    })
  })
})

// --- hasEquipment ---

describe('hasEquipment', () => {
  const profile = profileOf(
    item('ICU', 'T1'),
    item('Lab', 'T3', { qty: 0 }),
    item('Theatre', 'T2', { scheduleMask: Array<boolean>(24).fill(false) }),
  )

  test('true for a ward with an item', () => {
    expect(hasEquipment('ICU', profile)).toBe(true)
  })

  test('false for a ward with no items', () => {
    expect(hasEquipment('Maternity', profile)).toBe(false)
  })

  test('false when every item in the ward has qty 0', () => {
    expect(hasEquipment('Lab', profile)).toBe(false)
  })

  test('ignores the schedule', () => {
    expect(hasEquipment('Theatre', profile)).toBe(true)
  })

  test('a merged room has equipment if either ward does', () => {
    expect(hasEquipment(['Wards', 'Utilities'], profile)).toBe(false)
    expect(hasEquipment(['Wards', 'ICU'], profile)).toBe(true)
  })
})
