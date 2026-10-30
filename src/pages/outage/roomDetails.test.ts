import { describe, expect, test } from 'vitest'
import type { Equipment, Tier, TierKw, TwinStep, Ward } from '../../engine/types'
import { isRoomIdle, itemKw, itemStatus, roomCondition, roomServedKw } from './roomDetails'

const ALL_DAY = Array<boolean>(24).fill(true)
const OFFICE = Array.from({ length: 24 }, (_, hour) => hour >= 8 && hour < 17)
const NIGHT_STEP = 8 // 02:00
const DAY_STEP = 40 // 10:00

function item(ward: Ward, tier: Tier, over: Partial<Equipment> = {}): Equipment {
  return {
    id: `${ward}-${tier}`,
    name: `${ward} ${tier}`,
    ward,
    ratedW: 1000,
    dutyCycle: 0.5,
    scheduleMask: ALL_DAY,
    tier,
    qty: 2,
    ...over,
  }
}

const FULL: TierKw = { T1: 1, T2: 1, T3: 1 }

function twinStep(over: Partial<TwinStep> = {}): TwinStep {
  return {
    t: DAY_STEP,
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

const t3Shed = twinStep({ shedT3: true, servedKw: { T1: 1, T2: 1, T3: 0 } })
const allShed = twinStep({ shedT2: true, shedT3: true, servedKw: { T1: 1, T2: 0, T3: 0 } })
// Diesel-only style: nothing is shed on purpose, the supply just is not there.
const blackout = twinStep({ servedKw: { T1: 0, T2: 0, T3: 0 } })
const t2Short = twinStep({ servedKw: { T1: 1, T2: 0.4, T3: 1 } })

describe('itemKw', () => {
  test('rated watts times duty cycle times quantity, in kW', () => {
    expect(itemKw(item('ICU', 'T1'))).toBe(1)
  })
})

describe('itemStatus', () => {
  test('powered while its tier is served', () => {
    expect(itemStatus(item('Lab', 'T2'), DAY_STEP, twinStep())).toBe('powered')
  })

  test('not in use when its schedule is off, whatever the supply', () => {
    expect(itemStatus(item('Admin', 'T3', { scheduleMask: OFFICE }), NIGHT_STEP, blackout)).toBe('idle')
  })

  test('paused when its tier is shed', () => {
    expect(itemStatus(item('Wards', 'T3'), DAY_STEP, t3Shed)).toBe('paused')
  })

  test('no power when its tier is under-served without being shed', () => {
    expect(itemStatus(item('ICU', 'T1'), DAY_STEP, blackout)).toBe('no-power')
    expect(itemStatus(item('Lab', 'T2'), DAY_STEP, t2Short)).toBe('no-power')
    expect(itemStatus(item('Wards', 'T3'), DAY_STEP, blackout)).toBe('no-power')
  })
})

describe('isRoomIdle', () => {
  const theatre = [item('Theatre', 'T1', { scheduleMask: OFFICE }), item('Theatre', 'T2', { id: 'ac', scheduleMask: OFFICE })]

  test('a room is idle when none of its items is switched on at that step', () => {
    expect(isRoomIdle(theatre, NIGHT_STEP)).toBe(true)
  })

  test('one switched-on item is enough to make the room active', () => {
    expect(isRoomIdle(theatre, DAY_STEP)).toBe(false)
    expect(isRoomIdle([...theatre, item('Theatre', 'T1', { id: 'monitor' })], NIGHT_STEP)).toBe(false)
  })
})

describe('roomCondition', () => {
  const wardsRoom = [item('Wards', 'T2'), item('Wards', 'T3', { id: 'fan' })]

  test('lit and alarm pass straight through', () => {
    expect(roomCondition('lit', wardsRoom, DAY_STEP, twinStep())).toBe('lit')
    expect(roomCondition('alarm', [item('ICU', 'T1')], DAY_STEP, blackout)).toBe('alarm')
  })

  test('a shed tier reads as paused', () => {
    expect(roomCondition('dim', wardsRoom, DAY_STEP, t3Shed)).toBe('partly-paused')
    expect(roomCondition('dark', wardsRoom, DAY_STEP, allShed)).toBe('paused')
  })

  test('an under-served tier with no shed flag reads as no power', () => {
    expect(roomCondition('dim', [item('Lab', 'T2'), item('Lab', 'T3')], DAY_STEP, t2Short)).toBe('partly-powered')
    expect(roomCondition('dark', wardsRoom, DAY_STEP, blackout)).toBe('no-power')
  })

  test('when some loads are paused and others lost power, the lost power wins', () => {
    const mixed = twinStep({ shedT3: true, servedKw: { T1: 1, T2: 0, T3: 0 } })
    expect(roomCondition('dark', wardsRoom, DAY_STEP, mixed)).toBe('no-power')
  })

  test('a dark room with nothing switched on has no power', () => {
    const theatre = [item('Theatre', 'T1', { scheduleMask: OFFICE })]
    expect(roomCondition('dark', theatre, NIGHT_STEP, blackout)).toBe('no-power')
  })
})

describe('roomServedKw', () => {
  test('active items count in proportion to their tier being served', () => {
    const items = [item('Lab', 'T2'), item('Lab', 'T3', { id: 'b' }), item('Lab', 'T3', { id: 'c', scheduleMask: OFFICE })]
    expect(roomServedKw(items, NIGHT_STEP, t2Short)).toBeCloseTo(1.4)
    expect(roomServedKw(items, NIGHT_STEP, blackout)).toBe(0)
  })
})
