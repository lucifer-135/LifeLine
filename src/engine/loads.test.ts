import { expect, test } from 'vitest'
import { PRESETS } from '../data/presets'
import { buildLoadProfile } from './loads'
import type { Equipment, HospitalProfile } from './types'

function presetById(id: string): HospitalProfile {
  const preset = PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`Missing preset ${id}`)
  return preset
}

const kano = presetById('kano-50')

function item(changes: Partial<Equipment>): Equipment {
  return {
    id: 'x',
    name: 'x',
    ward: 'ICU',
    ratedW: 1000,
    dutyCycle: 1,
    scheduleMask: Array(24).fill(true),
    tier: 'T1',
    qty: 1,
    ...changes,
  }
}

test('single 1 kW T1 item all day', () => {
  const p = buildLoadProfile([item({})])
  expect(p.kw.T1).toHaveLength(96)
  expect(p.kw.T1.every((v) => v === 1)).toBe(true)
  expect(p.dailyKwh).toEqual({ T1: 24, T2: 0, T3: 0 })
  expect(p.peakKw.T1).toBe(1)
})

test('schedule mask hour 8 covers steps 32..35 only', () => {
  const scheduleMask = Array(24).fill(false)
  scheduleMask[8] = true
  const p = buildLoadProfile([item({ scheduleMask })])
  expect(p.kw.T1[31]).toBe(0)
  for (let s = 32; s <= 35; s++) expect(p.kw.T1[s]).toBe(1)
  expect(p.kw.T1[36]).toBe(0)
  expect(p.dailyKwh.T1).toBe(1)
})

test('kW is rated W x duty cycle x qty / 1000, summed per tier', () => {
  const p = buildLoadProfile([
    item({ tier: 'T2', ratedW: 500, dutyCycle: 0.5, qty: 4 }),
    item({ tier: 'T2', ratedW: 200, dutyCycle: 1, qty: 1 }),
    item({ tier: 'T3', ratedW: 100, dutyCycle: 1, qty: 3 }),
  ])
  expect(p.kw.T2.every((v) => v === 1.2)).toBe(true)
  expect(p.kw.T3.every((v) => v === 0.3)).toBe(true)
  expect(p.peakKw.T2).toBe(1.2)
  expect(p.dailyKwh.T2).toBeCloseTo(28.8, 10)
})

test('items with qty 0 contribute nothing and an empty tier is all zero', () => {
  const p = buildLoadProfile([item({ qty: 0 })])
  expect(p.kw.T1.every((v) => v === 0)).toBe(true)
  expect(p.kw.T2).toHaveLength(96)
  expect(p.kw.T3).toHaveLength(96)
  expect(p.dailyKwh).toEqual({ T1: 0, T2: 0, T3: 0 })
  expect(p.peakKw).toEqual({ T1: 0, T2: 0, T3: 0 })
})

test('peak is the highest step, not the average', () => {
  const scheduleMask = Array(24).fill(false)
  scheduleMask[12] = true
  const p = buildLoadProfile([item({}), item({ scheduleMask, ratedW: 2000 })])
  expect(p.peakKw.T1).toBe(3)
  expect(p.kw.T1[0]).toBe(1)
  expect(p.kw.T1[48]).toBe(3)
})

test('kano-50 daily energy is in a plausible hospital range', () => {
  const p = buildLoadProfile(kano.equipment)
  const total = p.dailyKwh.T1 + p.dailyKwh.T2 + p.dailyKwh.T3
  expect(total).toBeGreaterThan(200)
  expect(total).toBeLessThan(400)
})

test('kano-50 has life-critical load every step', () => {
  const p = buildLoadProfile(kano.equipment)
  expect(p.kw.T1.every((v) => v > 0)).toBe(true)
  expect(p.peakKw.T1).toBeGreaterThan(0)
})
