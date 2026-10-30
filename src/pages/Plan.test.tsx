import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { SOURCES } from '../data/sources'
import { runComparison } from '../engine/compare'
import { DEMO_SEED } from '../engine/constants'
import { computeFinance } from '../engine/finance'
import type { CostAssumptions, HospitalProfile, NigerianState } from '../engine/types'
import { formatDuration, formatNgn, formatPct, formatUsd, formatYears } from '../lib/format'
import { AppProvider, useApp } from '../state/AppState'
import type { Action } from '../state/AppState'
import { Plan } from './Plan'

// motion reads the reduced-motion query once, on the first useReducedMotion()
// call, then only updates when the query fires 'change'. So the query is
// installed at file scope, before any render, and tests flip it through
// setReducedMotion().
let reduceMotion = false
const changeListeners = new Set<EventListenerOrEventListenerObject>()

vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
  get matches() {
    return reduceMotion && query.includes('prefers-reduced-motion')
  },
  media: query,
  onchange: null,
  addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    changeListeners.add(listener)
  },
  removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    changeListeners.delete(listener)
  },
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

function setReducedMotion(reduce: boolean) {
  reduceMotion = reduce
  const event = new Event('change')
  for (const listener of changeListeners) {
    if (typeof listener === 'function') listener(event)
    else listener.handleEvent(event)
  }
}

// Lets a test dispatch actions and read the state the page is showing.
type App = ReturnType<typeof useApp>
let latestApp: App | null = null

function AppProbe() {
  const value = useApp()
  useEffect(() => {
    latestApp = value
  })
  return null
}

function app(): App {
  if (!latestApp) throw new Error('AppProbe has not rendered')
  return latestApp
}

function send(action: Action) {
  act(() => app().dispatch(action))
}

function renderPlan() {
  latestApp = null
  return render(
    <AppProvider>
      <Plan />
      <AppProbe />
    </AppProvider>,
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

afterEach(() => {
  setReducedMotion(false)
  vi.useRealTimers()
})

const KANO = PRESETS[0]

// What the page should show for the starting state, computed straight from the engine.
function expectedFor(costs: CostAssumptions = DEFAULT_COSTS, profile: HospitalProfile = KANO) {
  const comparison = runComparison({ profile, costs, seed: DEMO_SEED, season: 'typical' })
  const finance = computeFinance({
    baseline: comparison.baseline.metrics,
    lifeline: comparison.lifeline.metrics,
    size: comparison.size,
    costs,
  })
  return { comparison, finance }
}

const wholeTonnes = (tonnes: number) => `${Math.round(tonnes)} t a year`

function install(): HTMLElement {
  return screen.getByRole('region', { name: 'What to install' })
}

function pays(): HTMLElement {
  return screen.getByRole('region', { name: 'Who pays what' })
}

function proposal(): HTMLElement {
  return screen.getByRole('article', { name: 'Proposal' })
}

// The text beside a label: a dt's dd, or a bar label's value.
function valueOf(container: HTMLElement, label: string): string {
  const value = within(container).getByText(label).nextElementSibling
  if (!value) throw new Error(`Nothing follows "${label}"`)
  return value.textContent ?? ''
}

function openAssumptions() {
  const button = screen.getByRole('button', { name: /^Assumptions \(/ })
  if (button.getAttribute('aria-expanded') !== 'true') fireEvent.click(button)
}

function editField(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

// The warning is found by its copy, so the number fields' own range alerts do not count.
function shortfallAlert(): HTMLElement | null {
  return screen.queryByText(/without power for/)
}

const SHORTFALL_STATE: Action[] = [
  { type: 'loadPreset', presetId: 'phc' },
  { type: 'setSeason', season: 'worst' },
  { type: 'setSeed', seed: 1 },
  { type: 'updateProfile', patch: { gridHoursPerDay: 1, generatorKva: 0, dieselLitresPerMonth: 0 } },
]

function engineT1Minutes(): number {
  const { profile, costs, seed, season } = app().state
  return runComparison({ profile, costs, seed, season }).lifeline.metrics.t1MinutesUnpowered
}

describe('Plan page', () => {
  test('shows the plan for the starting hospital', () => {
    renderPlan()
    expect(screen.getByRole('heading', { level: 1, name: 'Plan & finance' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'What to install' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Who pays what' })).toBeInTheDocument()
    expect(within(pays()).getByRole('heading', { level: 3, name: 'For the investor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download proposal' })).toBeInTheDocument()
  })

  test('size rows give each size and a plain sentence, with the Kano worst month spelled out', () => {
    renderPlan()
    const { size } = expectedFor().comparison
    const rows = within(install())
    expect(rows.getByText('Solar')).toBeInTheDocument()
    expect(rows.getByText(`${size.pvKwp} kWp`)).toBeInTheDocument()
    expect(rows.getByText('Battery')).toBeInTheDocument()
    expect(rows.getByText(`${size.batteryKwh} kWh`)).toBeInTheDocument()
    expect(rows.getByText('Inverter')).toBeInTheDocument()
    expect(rows.getByText(`${size.inverterKw} kW`)).toBeInTheDocument()

    expect(
      rows.getByText(`${size.pvKwp} kWp of panels, sized for December — the month with the least sun in Kano.`),
    ).toBeInTheDocument()
    expect(
      rows.getByText(
        `${size.batteryKwh} kWh of lithium (LFP) storage, enough to carry life-critical and essential loads through the night.`,
      ),
    ).toBeInTheDocument()
    expect(
      rows.getByText(`${size.inverterKw} kW, with 25% headroom over the peak of life-critical and essential loads.`),
    ).toBeInTheDocument()
  })

  test.each<{ state: NigerianState; month: string }>([
    { state: 'Kano', month: 'December' },
    { state: 'FCT', month: 'August' },
    { state: 'Bayelsa', month: 'July' },
  ])('names the worst month in full for $state', ({ state, month }) => {
    renderPlan()
    send({ type: 'updateProfile', patch: { state } })
    expect(within(install()).getByText(new RegExp(`sized for ${month} — the month with the least sun in ${state}\\.$`))).toBeInTheDocument()
  })

  test('money panel shows the saving, both monthly amounts and the investor figures', () => {
    renderPlan()
    const { finance } = expectedFor()
    const panel = within(pays())

    expect(panel.getByText('Hospital saves')).toBeInTheDocument()
    expect(panel.getAllByText(formatNgn(finance.hospitalSavingsAnnualNgn)).length).toBeGreaterThan(0)
    expect(panel.getByText('a year')).toBeInTheDocument()

    expect(valueOf(pays(), 'Today')).toBe(formatNgn(finance.baselineAnnualNgn / 12))
    expect(valueOf(pays(), 'Lifeline fee')).toBe(formatNgn(finance.monthlyFeeNgn))
    const gap = finance.baselineAnnualNgn / 12 - finance.monthlyFeeNgn
    expect(panel.getByText(`Saves ${formatNgn(gap)} a month`)).toBeInTheDocument()

    expect(valueOf(pays(), 'Upfront cost')).toContain(formatNgn(finance.capexNgn))
    expect(valueOf(pays(), 'Upfront cost')).toContain(formatUsd(finance.capexNgn, DEFAULT_COSTS.ngnPerUsd))
    expect(valueOf(pays(), 'Payback')).toBe(formatYears(finance.paybackYears))
    expect(finance.irr).not.toBeNull()
    expect(valueOf(pays(), `Return over ${DEFAULT_COSTS.contractYears} years`)).toBe(
      `${formatPct(finance.irr ?? 0)} a year`,
    )
    expect(valueOf(pays(), 'CO₂ avoided')).toBe(wholeTonnes(finance.co2AvoidedTonnesYear))
  })

  test('fee slider changes the monthly fee', () => {
    renderPlan()
    const slider = screen.getByRole('slider', { name: "Monthly fee, as a share of today's spend" })
    expect(slider).toHaveAttribute('min', '70')
    expect(slider).toHaveAttribute('max', '85')
    expect(slider).toHaveAttribute('step', '1')
    expect(slider).toHaveValue('80')
    expect(slider).toHaveAttribute('aria-valuetext', '80%')

    const before = valueOf(pays(), 'Lifeline fee')
    fireEvent.change(slider, { target: { value: '70' } })

    const after = valueOf(pays(), 'Lifeline fee')
    expect(app().state.costs.feeFraction).toBe(0.7)
    expect(after).toBe(formatNgn(expectedFor({ ...DEFAULT_COSTS, feeFraction: 0.7 }).finance.monthlyFeeNgn))
    expect(after).not.toBe(before)
    expect(slider).toHaveAttribute('aria-valuetext', '70%')
  })

  test('payback and return read n/a when the fee is 0 via the editor, and nothing shows NaN or Infinity', () => {
    renderPlan()
    openAssumptions()
    editField('Monthly fee', '0')

    expect(app().state.costs.feeFraction).toBe(0)
    expect(valueOf(pays(), 'Payback')).toBe('n/a')
    expect(valueOf(pays(), `Return over ${DEFAULT_COSTS.contractYears} years`)).toBe('n/a')
    expect(document.body.textContent).not.toMatch(/Infinity|NaN/)
  })

  test('Download proposal opens the print dialog', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    renderPlan()
    fireEvent.click(screen.getByRole('button', { name: 'Download proposal' }))
    expect(print).toHaveBeenCalledTimes(1)
    print.mockRestore()
  })

  test('the money bars are drawn at once with reduced motion', () => {
    setReducedMotion(true)
    renderPlan()
    const finance = expectedFor().finance
    const bar = screen.getByText('Lifeline fee').closest('li')?.querySelector<HTMLElement>('[data-bar]')
    if (!bar) throw new Error('No bar for the Lifeline fee')
    // Both bars share one scale, so the fee bar is the fee as a share of today's spend.
    const expectedScale = finance.monthlyFeeNgn / (finance.baselineAnnualNgn / 12)
    expect(bar.style.transform).toBe(`scaleX(${expectedScale})`)
  })
})

describe('life-critical shortfall warning', () => {
  test('is absent when the engine reports no shortfall', () => {
    renderPlan()
    expect(engineT1Minutes()).toBe(0)
    expect(shortfallAlert()).toBeNull()
  })

  test('shows the exact copy when the design leaves life-critical equipment without power, and clears when fixed', () => {
    renderPlan()
    for (const action of SHORTFALL_STATE) send(action)

    // Guard: if the engine changes so this state no longer falls short, fail here
    // instead of passing for the wrong reason.
    const minutes = engineT1Minutes()
    expect(minutes).toBeGreaterThan(0)
    const alert = screen.getByText(
      `This design leaves life-critical equipment without power for ${formatDuration(minutes)}. Increase battery or generator size.`,
    )
    expect(alert.closest('[role="alert"]')).not.toBeNull()

    // The alert sits above "What to install" in reading order.
    const heading = screen.getByRole('heading', { name: 'What to install' })
    expect(alert.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const phc = PRESETS.find((p) => p.id === 'phc')
    if (!phc) throw new Error('Missing phc preset')
    send({
      type: 'updateProfile',
      patch: { generatorKva: phc.generatorKva, dieselLitresPerMonth: phc.dieselLitresPerMonth },
    })
    expect(engineT1Minutes()).toBe(0)
    expect(shortfallAlert()).toBeNull()
  })

  test('shows if and only if the engine reports a shortfall, for every step of a run of edits', () => {
    renderPlan()
    const edits: Action[] = [
      ...SHORTFALL_STATE,
      { type: 'updateProfile', patch: { gridHoursPerDay: 12 } },
      { type: 'updateProfile', patch: { gridHoursPerDay: 0 } },
      { type: 'setSeason', season: 'typical' },
      { type: 'loadPreset', presetId: 'kano-50' },
    ]
    for (const edit of edits) {
      send(edit)
      expect(shortfallAlert() !== null).toBe(engineT1Minutes() > 0)
    }
  })
})

describe('assumptions editor', () => {
  const COST_KEYS = Object.keys(DEFAULT_COSTS)

  test('is a closed disclosure that opens to one field per cost, each with its source', () => {
    renderPlan()
    const button = screen.getByRole('button', { name: `Assumptions (${COST_KEYS.length})` })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    const panelId = button.getAttribute('aria-controls')
    if (!panelId) throw new Error('The disclosure names no panel')
    const panel = document.getElementById(panelId)
    if (!panel) throw new Error('The disclosure names a panel that does not exist')
    expect(panel).toHaveAttribute('inert')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')

    const fields = within(panel)
    expect(fields.getAllByRole('spinbutton')).toHaveLength(COST_KEYS.length)
    for (const key of COST_KEYS) {
      const source = SOURCES.find((s) => s.id === `cost.${key}`)
      if (!source) throw new Error(`No source for ${key}`)
      expect(fields.getByLabelText(source.label)).toBeInTheDocument()
      expect(fields.getByRole('link', { name: `Source: ${source.label}` })).toHaveAttribute(
        'href',
        `#/method#src-cost.${key}`,
      )
    }
    const estimates = SOURCES.filter((s) => s.id.startsWith('cost.') && s.isEstimate)
    expect(fields.getAllByText('Estimate')).toHaveLength(estimates.length)
    expect(fields.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument()
  })

  test('shows fractions as percentages and writes them back as fractions', () => {
    renderPlan()
    openAssumptions()
    expect(screen.getByLabelText('Monthly fee')).toHaveValue(80)
    expect(screen.getByLabelText('Balance of system')).toHaveValue(15)
    expect(screen.getByLabelText('Operations and maintenance')).toHaveValue(2)

    editField('Balance of system', '7')
    expect(app().state.costs.bosFraction).toBe(0.07)
    editField('Contract length', '12')
    expect(app().state.costs.contractYears).toBe(12)
    const twelveYears = expectedFor({ ...DEFAULT_COSTS, bosFraction: 0.07, contractYears: 12 }).finance
    expect(valueOf(pays(), 'Return over 12 years')).toBe(`${formatPct(twelveYears.irr ?? 0)} a year`)
  })

  test('Reset to defaults restores every assumption and the fields that show them', () => {
    renderPlan()
    openAssumptions()
    editField('Monthly fee', '60')
    editField('Diesel price', '5000')
    expect(app().state.costs).not.toEqual(DEFAULT_COSTS)

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))

    expect(app().state.costs).toEqual(DEFAULT_COSTS)
    expect(screen.getByLabelText('Monthly fee')).toHaveValue(80)
    expect(screen.getByLabelText('Diesel price')).toHaveValue(DEFAULT_COSTS.dieselNgnPerLitre)
  })

  test('a cost error keeps the editor open and usable, lists the message, and hides the numbers', () => {
    renderPlan()
    openAssumptions()
    const field = screen.getByLabelText('Diesel price')
    editField('Diesel price', '-5')

    const message = screen.getByText('Diesel price must be zero or more.')
    expect(message.closest('[role="alert"]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Plan & finance' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What to install' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Who pays what' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download proposal' })).toBeNull()
    // The same field stays mounted, so the person can keep typing in it.
    expect(screen.getByLabelText('Diesel price')).toBe(field)

    editField('Diesel price', String(DEFAULT_COSTS.dieselNgnPerLitre))
    expect(screen.queryByText('Diesel price must be zero or more.')).toBeNull()
    expect(screen.getByRole('heading', { name: 'What to install' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Assumptions \(/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Diesel price')).toBe(field)
  })
})

describe('profile errors', () => {
  test('keep the heading, say why, and link to the profile', () => {
    renderPlan()
    send({ type: 'updateProfile', patch: { gridHoursPerDay: 30 } })

    expect(screen.getByRole('heading', { level: 1, name: 'Plan & finance' })).toBeInTheDocument()
    expect(screen.getByText("This hospital profile has errors, so the plan can't be sized.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fix hospital profile' })).toHaveAttribute('href', '#/profile')
    expect(screen.queryByRole('heading', { name: 'What to install' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Assumptions/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download proposal' })).toBeNull()
    expect(screen.queryByRole('article', { name: 'Proposal' })).toBeNull()
  })
})

describe('proposal', () => {
  test('summarises the hospital, the outage day, the offer and the investor case', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 30, 12))
    renderPlan()
    const { comparison, finance } = expectedFor()
    const { size, baseline, lifeline } = comparison
    const sheet = within(proposal())

    expect(
      sheet.getByRole('heading', { level: 2, name: `Power continuity proposal for ${KANO.name}` }),
    ).toBeInTheDocument()
    expect(sheet.getByText('30 October 2026')).toBeInTheDocument()

    for (const text of [`${size.pvKwp} kWp`, `${size.batteryKwh} kWh`, `${size.inverterKw} kW`]) {
      expect(sheet.getByText(text)).toBeInTheDocument()
    }

    const result = sheet.getByRole('table', { name: 'Outage day result' })
    expect(within(result).getByRole('columnheader', { name: 'Today: diesel only' })).toBeInTheDocument()
    expect(within(result).getByRole('columnheader', { name: 'With Lifeline' })).toBeInTheDocument()
    const row = (name: string) => within(result).getByRole('row', { name: new RegExp(`^${name}`) })
    expect(row('Life-critical without power')).toHaveTextContent(
      `${formatDuration(baseline.metrics.t1MinutesUnpowered)}${formatDuration(lifeline.metrics.t1MinutesUnpowered)}`,
    )
    expect(row('Diesel burned')).toHaveTextContent(
      `${Math.round(baseline.metrics.dieselLitres)} L${Math.round(lifeline.metrics.dieselLitres)} L`,
    )
    expect(row('Energy cost')).toHaveTextContent(
      `${formatNgn(baseline.metrics.energyCostNgn)}${formatNgn(lifeline.metrics.energyCostNgn)}`,
    )
    expect(row('CO₂')).toHaveTextContent(
      `${Math.round(baseline.metrics.co2Kg)} kg${Math.round(lifeline.metrics.co2Kg)} kg`,
    )

    const offer = sheet.getByRole('heading', { name: 'The offer' }).closest('section')
    if (!offer) throw new Error('The offer is not in a section')
    expect(valueOf(offer, 'Monthly fee')).toBe(formatNgn(finance.monthlyFeeNgn))
    expect(valueOf(offer, "Today's monthly spend")).toBe(formatNgn(finance.baselineAnnualNgn / 12))
    expect(valueOf(offer, 'Savings per year')).toBe(formatNgn(finance.hospitalSavingsAnnualNgn))
    expect(valueOf(offer, 'Contract length')).toBe(`${DEFAULT_COSTS.contractYears} years`)

    const investor = sheet.getByRole('heading', { name: 'For the investor' }).closest('section')
    if (!investor) throw new Error('For the investor is not in a section')
    expect(valueOf(investor, 'Upfront cost')).toContain(formatNgn(finance.capexNgn))
    expect(valueOf(investor, 'Payback')).toBe(formatYears(finance.paybackYears))
    expect(valueOf(investor, `Return over ${DEFAULT_COSTS.contractYears} years`)).toBe(
      `${formatPct(finance.irr ?? 0)} a year`,
    )

    expect(sheet.getByRole('heading', { name: 'How we got these numbers' })).toBeInTheDocument()
    expect(
      sheet.getByText(`Full method and sources: ${window.location.origin}${window.location.pathname}#/method`),
    ).toBeInTheDocument()
    expect(
      sheet.getByText('Generated by Lifeline. Figures are estimates for planning and need a site audit before contract.'),
    ).toBeInTheDocument()
  })

  test('shows n/a, never Infinity, for CO₂ when the diesel CO₂ factor overflows', () => {
    renderPlan()
    send({ type: 'updateCosts', patch: { co2KgPerLitreDiesel: 1e307 } })
    const co2 = within(proposal()).getByRole('row', { name: /^CO₂/ })
    expect(co2).toHaveTextContent('n/a')
    expect(proposal().textContent).not.toMatch(/Infinity|NaN/)
  })

  test('shows n/a, never NaN or Infinity, when there is no return to measure', () => {
    renderPlan()
    openAssumptions()
    editField('Monthly fee', '0')
    const investor = within(proposal()).getByRole('heading', { name: 'For the investor' }).closest('section')
    if (!investor) throw new Error('For the investor is not in a section')
    expect(valueOf(investor, 'Payback')).toBe('n/a')
    expect(valueOf(investor, `Return over ${DEFAULT_COSTS.contractYears} years`)).toBe('n/a')
    expect(proposal().textContent).not.toMatch(/Infinity|NaN/)
  })
})
