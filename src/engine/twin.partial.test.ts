import { describe, expect, test } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { runComparison } from './compare'
import { DEMO_SEED } from './constants'
import { computeMetrics, partialMetrics } from './twin'

const kano = PRESETS.find((p) => p.id === 'kano-50')
if (!kano) throw new Error('Missing preset kano-50')

const { baseline, lifeline } = runComparison({
  profile: kano,
  costs: DEFAULT_COSTS,
  seed: DEMO_SEED,
  season: 'typical',
})

const scenarios = [
  ['baseline', baseline],
  ['lifeline', lifeline],
] as const

describe.each(scenarios)('partialMetrics (%s)', (_name, result) => {
  test('over the whole day equals the result metrics', () => {
    expect(partialMetrics(result, 95, DEFAULT_COSTS)).toEqual(result.metrics)
  })

  test('at step 0 equals the metrics of the first step alone', () => {
    expect(partialMetrics(result, 0, DEFAULT_COSTS)).toEqual(
      computeMetrics(result.steps.slice(0, 1), DEFAULT_COSTS),
    )
  })

  test('includes the step it is given', () => {
    expect(partialMetrics(result, 10, DEFAULT_COSTS)).toEqual(
      computeMetrics(result.steps.slice(0, 11), DEFAULT_COSTS),
    )
  })

  test('diesel litres, cost and CO2 never decrease from one step to the next', () => {
    let previous = partialMetrics(result, 0, DEFAULT_COSTS)
    for (let step = 1; step < result.steps.length; step++) {
      const current = partialMetrics(result, step, DEFAULT_COSTS)
      expect(current.dieselLitres).toBeGreaterThanOrEqual(previous.dieselLitres)
      expect(current.gridKwh).toBeGreaterThanOrEqual(previous.gridKwh)
      expect(current.energyCostNgn).toBeGreaterThanOrEqual(previous.energyCostNgn)
      expect(current.co2Kg).toBeGreaterThanOrEqual(previous.co2Kg)
      expect(current.t1MinutesUnpowered).toBeGreaterThanOrEqual(previous.t1MinutesUnpowered)
      expect(current.t2MinutesUnpowered).toBeGreaterThanOrEqual(previous.t2MinutesUnpowered)
      previous = current
    }
  })

  test('clamps a step past the end to the whole day', () => {
    expect(partialMetrics(result, 500, DEFAULT_COSTS)).toEqual(result.metrics)
  })

  test('clamps a negative step to step 0', () => {
    expect(partialMetrics(result, -3, DEFAULT_COSTS)).toEqual(
      partialMetrics(result, 0, DEFAULT_COSTS),
    )
  })
})

test('does not change the result it reads', () => {
  const before = structuredClone(baseline)
  partialMetrics(baseline, 40, DEFAULT_COSTS)
  expect(baseline).toEqual(before)
})
