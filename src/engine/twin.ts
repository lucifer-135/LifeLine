import {
  BATTERY_ONE_WAY,
  BATTERY_RESERVE_SOC,
  PV_STRONG_END_HOUR,
  PV_STRONG_START_HOUR,
  STEPS_PER_DAY,
  STEP_HOURS,
} from './constants'
import { pvOutputKw } from './solar'
import type {
  CostAssumptions,
  GridPattern,
  LoadProfile,
  Scenario,
  SystemSize,
  Tier,
  TierKw,
  TwinEvent,
  TwinEventKind,
  TwinMetrics,
  TwinResult,
  TwinStep,
} from './types'

export interface TwinInput {
  scenario: Scenario
  load: LoadProfile
  grid: GridPattern
  size: SystemSize
  psh: number
  generatorKw: number
  fuelLitresPerDay: number
  costs: CostAssumptions
}

const STEPS_PER_HOUR = STEPS_PER_DAY / 24
const WARM_UP_SOC = 0.5
// Restoring only once the need is well under the available energy stops a tier
// flapping on and off from one step to the next.
const RESTORE_HYSTERESIS = 0.8
const EPS = 1e-9
const ALL_TIERS: Tier[] = ['T1', 'T2', 'T3']
const PROTECTED_TIERS: Tier[] = ['T1', 'T2']
// Unserved demand falls on the lowest tier first, so life-critical load is the last to go dark.
const CUT_ORDER: Tier[] = ['T3', 'T2', 'T1']

interface TwinContext {
  input: TwinInput
  pvKw: number[]
}

// State carried from one step into the next.
interface StepStart {
  soc: number
  fuelLeft: number
  shedT2: boolean
  shedT3: boolean
}

interface Shedding {
  shedT2: boolean
  shedT3: boolean
}

type StepFunction = (ctx: TwinContext, s: number, start: StepStart) => TwinStep

// --- battery and fuel ---

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// kW the battery can deliver this step before its charge falls to `floorSoc`.
function dischargeLimitKw(soc: number, floorSoc: number, cap: number): number {
  return (Math.max(0, soc - floorSoc) * cap * BATTERY_ONE_WAY) / STEP_HOURS
}

// kW the battery can absorb this step without overfilling or exceeding the inverter.
function chargeLimitKw(soc: number, size: SystemSize): number {
  if (size.batteryKwh <= 0) return 0
  const roomKw = ((1 - soc) * size.batteryKwh) / (STEP_HOURS * BATTERY_ONE_WAY)
  return Math.max(0, Math.min(size.inverterKw, roomKw))
}

function nextSoc(soc: number, chargeKw: number, dischargeKw: number, cap: number): number {
  if (cap <= 0) return soc
  const storedKwh =
    chargeKw * STEP_HOURS * BATTERY_ONE_WAY - (dischargeKw * STEP_HOURS) / BATTERY_ONE_WAY
  return clamp01(soc + storedKwh / cap)
}

// A zero or negative fuel rate would divide by zero, so it is treated as free running.
function dieselLimitKw(generatorKw: number, fuelLeft: number, litresPerKwh: number): number {
  const fuelLimitKw = litresPerKwh > 0 ? fuelLeft / (litresPerKwh * STEP_HOURS) : generatorKw
  return Math.max(0, Math.min(generatorKw, fuelLimitKw))
}

function litresBurned(dieselKw: number, litresPerKwh: number): number {
  return litresPerKwh > 0 ? dieselKw * STEP_HOURS * litresPerKwh : 0
}

// Minutes the battery plus remaining fuel could carry life-critical load at this
// step's demand. Fuel counts only if there is a generator to burn it in.
function t1RunwayMin(
  input: TwinInput,
  gridUp: boolean,
  soc: number,
  fuelLeft: number,
  t1Kw: number,
): number {
  if (gridUp) return Infinity
  const litresPerKwh = input.costs.dieselLitresPerKwh
  const fuelKwh = input.generatorKw > 0 && litresPerKwh > 0 ? fuelLeft / litresPerKwh : 0
  const batteryKwh = soc * input.size.batteryKwh * BATTERY_ONE_WAY
  return ((batteryKwh + fuelKwh) / Math.max(t1Kw, EPS)) * 60
}

// --- load helpers ---

function loadAt(load: LoadProfile, s: number): TierKw {
  return { T1: load.kw.T1[s], T2: load.kw.T2[s], T3: load.kw.T3[s] }
}

function sumTiers(kw: TierKw, tiers: Tier[]): number {
  return tiers.reduce((sum, tier) => sum + kw[tier], 0)
}

function servingTiers(shed: Shedding): Tier[] {
  return ALL_TIERS.filter(
    (tier) => !(tier === 'T2' && shed.shedT2) && !(tier === 'T3' && shed.shedT3),
  )
}

function allocateServed(loadKw: TierKw, shed: Shedding, unservedKw: number): TierKw {
  const served: TierKw = {
    T1: loadKw.T1,
    T2: shed.shedT2 ? 0 : loadKw.T2,
    T3: shed.shedT3 ? 0 : loadKw.T3,
  }
  let left = unservedKw
  for (const tier of CUT_ORDER) {
    const cut = Math.min(left, served[tier])
    served[tier] -= cut
    left -= cut
  }
  return served
}

// --- Lifeline controller ---

function isStrongPvStep(k: number): boolean {
  const midpointHour = (k + 0.5) / STEPS_PER_HOUR
  return midpointHour >= PV_STRONG_START_HOUR && midpointHour < PV_STRONG_END_HOUR
}

// The first later step (wrapping past midnight) where the grid is back or strong sun
// takes over. Returns `s` itself when no relief comes within the day, so the need
// then covers the whole circular day.
function findReliefStep(grid: GridPattern, s: number): number {
  for (let i = 1; i < STEPS_PER_DAY; i++) {
    const k = (s + i) % STEPS_PER_DAY
    if (grid.up[k] || isStrongPvStep(k)) return k
  }
  return s
}

// Battery energy (kWh) the given tiers need, net of PV, from step `s` up to relief.
function energyNeeded(ctx: TwinContext, s: number, relief: number, tiers: Tier[]): number {
  let needKwh = 0
  let k = s
  do {
    const netKw = sumTiers(loadAt(ctx.input.load, k), tiers) - ctx.pvKw[k]
    needKwh += Math.max(0, netKw) * STEP_HOURS
    k = (k + 1) % STEPS_PER_DAY
  } while (k !== relief)
  return needKwh
}

// Sheds on battery energy alone: diesel is held back for emergencies, so a load is
// only kept on if the battery above its reserve can carry it until relief.
function decideShedding(
  previous: Shedding,
  needAllKwh: number,
  needProtectedKwh: number,
  availKwh: number,
): Shedding {
  let shedT3 = previous.shedT3 || needAllKwh > availKwh
  let shedT2 = previous.shedT2 || needProtectedKwh > availKwh
  if (shedT2 && needProtectedKwh < RESTORE_HYSTERESIS * availKwh) shedT2 = false
  if (shedT3 && !shedT2 && needAllKwh < RESTORE_HYSTERESIS * availKwh) shedT3 = false
  return { shedT2, shedT3 }
}

function outageShedding(ctx: TwinContext, s: number, start: StepStart): Shedding {
  const relief = findReliefStep(ctx.input.grid, s)
  const availKwh =
    Math.max(0, start.soc - BATTERY_RESERVE_SOC) * ctx.input.size.batteryKwh * BATTERY_ONE_WAY
  return decideShedding(
    start,
    energyNeeded(ctx, s, relief, ALL_TIERS),
    energyNeeded(ctx, s, relief, PROTECTED_TIERS),
    availKwh,
  )
}

// Grid up: every tier is served, PV first. The battery fills from spare PV, then
// from the grid, and any PV still left over is curtailed.
function dispatchGridStep(ctx: TwinContext, s: number, start: StepStart): TwinStep {
  const { input } = ctx
  const loadKw = loadAt(input.load, s)
  const demandKw = sumTiers(loadKw, ALL_TIERS)
  const pvKw = ctx.pvKw[s]
  const pvUsedKw = Math.min(pvKw, demandKw)
  const chargeRoomKw = chargeLimitKw(start.soc, input.size)
  const pvChargeKw = Math.min(pvKw - pvUsedKw, chargeRoomKw)
  const gridChargeKw = chargeRoomKw - pvChargeKw
  const chargeKw = pvChargeKw + gridChargeKw
  const soc = nextSoc(start.soc, chargeKw, 0, input.size.batteryKwh)
  return {
    t: s,
    gridUp: true,
    loadKw,
    servedKw: { ...loadKw },
    shedT2: false,
    shedT3: false,
    pvKw,
    pvUsedKw,
    curtailedKw: pvKw - pvUsedKw - pvChargeKw,
    gridKw: demandKw - pvUsedKw + gridChargeKw,
    chargeKw,
    dischargeKw: 0,
    dieselKw: 0,
    soc,
    fuelLitresLeft: start.fuelLeft,
    t1RunwayMin: t1RunwayMin(input, true, soc, start.fuelLeft, loadKw.T1),
  }
}

// Grid down: PV first, then the battery down to its reserve, then diesel, then the
// battery's reserve. Whatever is still missing goes unserved.
function dispatchOutageStep(ctx: TwinContext, s: number, start: StepStart): TwinStep {
  const { input } = ctx
  const { batteryKwh: cap, inverterKw } = input.size
  const shed = outageShedding(ctx, s, start)
  const loadKw = loadAt(input.load, s)
  const demandKw = sumTiers(loadKw, servingTiers(shed))

  const pvKw = ctx.pvKw[s]
  const pvUsedKw = Math.min(pvKw, demandKw)
  const chargeKw = Math.min(pvKw - pvUsedKw, chargeLimitKw(start.soc, input.size))
  let remainingKw = demandKw - pvUsedKw

  const inverterLimitKw = Math.max(0, inverterKw)
  const aboveReserveKw = Math.min(
    remainingKw,
    inverterLimitKw,
    dischargeLimitKw(start.soc, BATTERY_RESERVE_SOC, cap),
  )
  remainingKw -= aboveReserveKw

  const litresPerKwh = input.costs.dieselLitresPerKwh
  const dieselKw = Math.min(
    remainingKw,
    dieselLimitKw(input.generatorKw, start.fuelLeft, litresPerKwh),
  )
  remainingKw -= dieselKw

  const belowReserveKw = Math.max(
    0,
    Math.min(
      remainingKw,
      inverterLimitKw - aboveReserveKw,
      dischargeLimitKw(start.soc, 0, cap) - aboveReserveKw,
    ),
  )
  remainingKw -= belowReserveKw

  const dischargeKw = aboveReserveKw + belowReserveKw
  const soc = nextSoc(start.soc, chargeKw, dischargeKw, cap)
  const fuelLitresLeft = Math.max(0, start.fuelLeft - litresBurned(dieselKw, litresPerKwh))
  return {
    t: s,
    gridUp: false,
    loadKw,
    servedKw: allocateServed(loadKw, shed, remainingKw),
    shedT2: shed.shedT2,
    shedT3: shed.shedT3,
    pvKw,
    pvUsedKw,
    curtailedKw: pvKw - pvUsedKw - chargeKw,
    gridKw: 0,
    chargeKw,
    dischargeKw,
    dieselKw,
    soc,
    fuelLitresLeft,
    t1RunwayMin: t1RunwayMin(input, false, soc, fuelLitresLeft, loadKw.T1),
  }
}

function lifelineStep(ctx: TwinContext, s: number, start: StepStart): TwinStep {
  return ctx.input.grid.up[s]
    ? dispatchGridStep(ctx, s, start)
    : dispatchOutageStep(ctx, s, start)
}

function stepFunctionFor(scenario: Scenario): StepFunction {
  switch (scenario) {
    case 'lifeline':
      return lifelineStep
    case 'baseline':
      throw new Error('baseline scenario not implemented yet')
  }
}

// --- events and metrics ---

const isDieselOn = (step: TwinStep): boolean => step.dieselKw > EPS
const isFuelOut = (step: TwinStep): boolean => step.fuelLitresLeft <= EPS
const isT1Short = (step: TwinStep): boolean => step.servedKw.T1 < step.loadKw.T1 - EPS

// Listed in TwinEventKind order, so events within one step always come out in that order.
function diffEvents(previous: TwinStep, current: TwinStep): TwinEvent[] {
  const transitions: [TwinEventKind, boolean][] = [
    ['grid_lost', previous.gridUp && !current.gridUp],
    ['grid_restored', !previous.gridUp && current.gridUp],
    ['shed_t3', !previous.shedT3 && current.shedT3],
    ['shed_t2', !previous.shedT2 && current.shedT2],
    ['restore_t2', previous.shedT2 && !current.shedT2],
    ['restore_t3', previous.shedT3 && !current.shedT3],
    ['diesel_on', !isDieselOn(previous) && isDieselOn(current)],
    ['diesel_off', isDieselOn(previous) && !isDieselOn(current)],
    ['fuel_out', !isFuelOut(previous) && isFuelOut(current)],
    ['t1_unpowered', !isT1Short(previous) && isT1Short(current)],
    ['t1_restored', isT1Short(previous) && !isT1Short(current)],
  ]
  return transitions
    .filter(([, happened]) => happened)
    .map(([kind]) => ({ step: current.t, kind, t1RunwayMin: current.t1RunwayMin }))
}

export function computeMetrics(steps: TwinStep[], costs: CostAssumptions): TwinMetrics {
  let unpoweredT1Steps = 0
  let unpoweredT2Steps = 0
  let dieselLitres = 0
  let gridKwh = 0
  for (const step of steps) {
    if (isT1Short(step)) unpoweredT1Steps += 1
    if (step.servedKw.T2 < step.loadKw.T2 - EPS) unpoweredT2Steps += 1
    dieselLitres += litresBurned(step.dieselKw, costs.dieselLitresPerKwh)
    gridKwh += step.gridKw * STEP_HOURS
  }
  const stepMinutes = STEP_HOURS * 60
  return {
    t1MinutesUnpowered: unpoweredT1Steps * stepMinutes,
    t2MinutesUnpowered: unpoweredT2Steps * stepMinutes,
    dieselLitres,
    gridKwh,
    energyCostNgn: gridKwh * costs.gridNgnPerKwh + dieselLitres * costs.dieselNgnPerLitre,
    co2Kg: dieselLitres * costs.co2KgPerLitreDiesel + gridKwh * costs.gridCo2KgPerKwh,
  }
}

// --- run ---

function runDay(ctx: TwinContext, stepFunction: StepFunction, first: StepStart): TwinStep[] {
  const steps: TwinStep[] = []
  let start = first
  for (let s = 0; s < STEPS_PER_DAY; s++) {
    const step = stepFunction(ctx, s, start)
    steps.push(step)
    start = {
      soc: step.soc,
      fuelLeft: step.fuelLitresLeft,
      shedT2: step.shedT2,
      shedT3: step.shedT3,
    }
  }
  return steps
}

// The day runs twice and only the second pass is returned: the warm-up day gives a
// realistic starting charge. Fuel is refilled each day; everything else carries over.
export function runTwin(input: TwinInput): TwinResult {
  const stepFunction = stepFunctionFor(input.scenario)
  const ctx: TwinContext = {
    input,
    pvKw: Array.from({ length: STEPS_PER_DAY }, (_, s) =>
      pvOutputKw(input.size.pvKwp, input.psh, s),
    ),
  }
  // A missing battery holds no charge, so the gauge reads empty rather than half full.
  const warmUpStart: StepStart = {
    soc: input.size.batteryKwh > 0 ? WARM_UP_SOC : 0,
    fuelLeft: input.fuelLitresPerDay,
    shedT2: false,
    shedT3: false,
  }
  const warmUp = runDay(ctx, stepFunction, warmUpStart)
  const lastWarmUp = warmUp[STEPS_PER_DAY - 1]
  const steps = runDay(ctx, stepFunction, {
    soc: lastWarmUp.soc,
    fuelLeft: input.fuelLitresPerDay,
    shedT2: lastWarmUp.shedT2,
    shedT3: lastWarmUp.shedT3,
  })
  const events = steps.flatMap((step, s) => diffEvents(s === 0 ? lastWarmUp : steps[s - 1], step))
  return { scenario: input.scenario, steps, events, metrics: computeMetrics(steps, input.costs) }
}
