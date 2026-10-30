import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_COSTS } from '../data/costs'
import { PRESETS } from '../data/presets'
import { runComparison } from '../engine/compare'
import { DEMO_SEED } from '../engine/constants'
import { stepToClock } from '../engine/events'
import { partialMetrics } from '../engine/twin'
import { formatDuration, formatNgn } from '../lib/format'
import { AppProvider, useApp } from '../state/AppState'
import { OutageDay } from './OutageDay'

// The page renders the app's starting state: the Kano demo hospital on the demo day.
// The expected numbers come from the engine, so the tests follow the model.
const demoProfile = PRESETS.find((p) => p.id === 'kano-50')
if (!demoProfile) throw new Error('Missing the kano-50 preset')
const demo = runComparison({ profile: demoProfile, costs: DEFAULT_COSTS, seed: DEMO_SEED, season: 'typical' })

// The first step where the grid goes down after being up.
const firstOutageStep = demo.grid.up.findIndex((up, s) => s > 0 && !up && demo.grid.up[s - 1])

// Breaks the profile and shows the seed, so a test can reach past the page.
function StateProbe() {
  const { state, dispatch } = useApp()
  return (
    <>
      <output data-testid="seed">{state.seed}</output>
      <button type="button" onClick={() => dispatch({ type: 'updateProfile', patch: { beds: 0 } })}>
        Break the profile
      </button>
    </>
  )
}

function renderOutage(hash = '#/outage') {
  window.history.replaceState(null, '', hash)
  return render(
    <AppProvider>
      <OutageDay />
      <StateProbe />
    </AppProvider>,
  )
}

function scrubber(): HTMLElement {
  return screen.getByRole('slider', { name: 'Time of day' })
}

function seek(step: number) {
  fireEvent.change(scrubber(), { target: { value: String(step) } })
}

function chooseScenario(name: 'With Lifeline' | 'Today: diesel only') {
  fireEvent.click(screen.getByRole('radio', { name }))
}

function runway(): HTMLElement {
  return screen.getByRole('region', { name: 'ICU runway' })
}

// The ward rooms on the floor plan: buttons whose name is "{Room}: {state}, … kW served".
function roomButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /kW served$/ })
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

// Motion and the playback timer both run on timers. Faking them keeps every
// update inside act(), and lets a test count what is left after unmount.
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', window.location.pathname)
})

describe('OutageDay', () => {
  test('outage page shows runway and both comparison columns', () => {
    renderOutage()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Outage day' })).toBeInTheDocument()
    expect(within(runway()).getByText('On grid power')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Today: diesel only' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'With Lifeline' })).toBeInTheDocument()
    expect(scrubber()).toHaveAttribute('aria-valuetext', '00:00')
  })

  test('seek to end shows verdict with baseline T1 minutes > 0 and lifeline 0', () => {
    expect(demo.baseline.metrics.t1MinutesUnpowered).toBeGreaterThan(0)
    expect(demo.lifeline.metrics.t1MinutesUnpowered).toBe(0)
    renderOutage()
    expect(screen.queryByText(/With Lifeline: 0 minutes/)).not.toBeInTheDocument()

    seek(95)

    const saving = demo.baseline.metrics.energyCostNgn - demo.lifeline.metrics.energyCostNgn
    const verdict = screen.getByText(/With Lifeline: 0 minutes\./)
    expect(verdict).toHaveTextContent(
      `Today, life-critical equipment went ${formatDuration(demo.baseline.metrics.t1MinutesUnpowered)} without power. ` +
        `With Lifeline: 0 minutes. Lifeline would also save ${formatNgn(saving)} today.`,
    )
    expect(verdict.textContent).toContain('0 min')
  })

  test('the comparison counts up to the full-day totals at the end of the day', () => {
    renderOutage()
    seek(95)
    const baseline = screen.getByRole('heading', { name: 'Today: diesel only' }).closest('div')
    const lifeline = screen.getByRole('heading', { name: 'With Lifeline' }).closest('div')
    if (!baseline || !lifeline) throw new Error('A comparison column has no container')

    // CountUp keeps its final value in a visually hidden twin of the animated number.
    for (const [column, result] of [
      [baseline, demo.baseline],
      [lifeline, demo.lifeline],
    ] as const) {
      const { t1MinutesUnpowered, dieselLitres, energyCostNgn, co2Kg } = result.metrics
      for (const expected of [
        formatDuration(t1MinutesUnpowered),
        `${Math.round(dieselLitres)} L`,
        formatNgn(energyCostNgn),
        `${Math.round(co2Kg)} kg`,
      ]) {
        expect(within(column).getByText(expected, { selector: '.visually-hidden' })).toBeInTheDocument()
      }
    }
  })

  test('the running totals cover the day so far, not the whole day', () => {
    const midDay = firstOutageStep + 4
    const soFar = Math.round(partialMetrics(demo.baseline, midDay, DEFAULT_COSTS).dieselLitres)
    const fullDay = Math.round(demo.baseline.metrics.dieselLitres)
    expect(soFar).not.toBe(fullDay)
    renderOutage()
    seek(midDay)

    const baseline = screen.getByRole('heading', { name: 'Today: diesel only' }).closest('div')
    if (!baseline) throw new Error('The diesel-only column has no container')
    expect(within(baseline).getByText(`${soFar} L`, { selector: '.visually-hidden' })).toBeInTheDocument()
    expect(within(baseline).queryByText(`${fullDay} L`, { selector: '.visually-hidden' })).not.toBeInTheDocument()
  })

  test('invalid profile shows link back to profile instead of charts', () => {
    renderOutage('#/outage?autoplay=1')
    fireEvent.click(screen.getByRole('button', { name: 'Break the profile' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Outage day' })).toBeInTheDocument()
    expect(screen.getByText("This hospital profile has errors, so the outage day can't run.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fix hospital profile' })).toHaveAttribute('href', '#/profile')
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ICU: / })).not.toBeInTheDocument()
    advance(1000)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('#/outage?autoplay=1 plays the day on a timer', () => {
    renderOutage('#/outage?autoplay=1')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    advance(400)
    expect(scrubber()).toHaveValue('1')
    expect(scrubber()).toHaveAttribute('aria-valuetext', '00:15')

    fireEvent.click(screen.getByRole('radio', { name: '16×' }))
    advance(25 * 10)
    expect(scrubber()).toHaveValue('11')
  })

  test('without autoplay the day waits for Play', () => {
    renderOutage()
    advance(2000)
    expect(scrubber()).toHaveValue('0')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    advance(400)
    expect(scrubber()).toHaveValue('1')
  })

  test('Space toggles play on the bar itself, but not on its buttons', () => {
    renderOutage()
    const bar = screen.getByRole('group', { name: 'Playback' })

    fireEvent.keyDown(bar, { key: ' ' })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()

    // A button turns Space into a click itself; the bar must not toggle a second time.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Pause' }), { key: ' ' })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  test('scenario toggle at the first outage shows the ICU without power today', () => {
    expect(firstOutageStep).toBeGreaterThan(0)
    renderOutage()
    seek(firstOutageStep)
    expect(within(runway()).getByText('ICU covered for')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ICU: lit/ })).toBeInTheDocument()

    chooseScenario('Today: diesel only')

    expect(within(runway()).getByText('ICU without power')).toBeInTheDocument()
    expect(within(runway()).getByText(/^No battery/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ICU: no power/ })).toBeInTheDocument()
    // The comparison keeps both columns whatever the scenario.
    expect(screen.getByRole('heading', { name: 'With Lifeline' })).toBeInTheDocument()
  })

  test('the runway turns to the warning level under 2 hours of cover', () => {
    const warnStep = demo.baseline.steps.findIndex(
      (s) => !s.gridUp && s.servedKw.T1 >= s.loadKw.T1 && s.t1RunwayMin < 120,
    )
    expect(warnStep).toBeGreaterThan(0)
    renderOutage()
    chooseScenario('Today: diesel only')
    seek(warnStep)
    expect(runway()).toHaveAttribute('data-level', 'warn')
    expect(within(runway()).getByText(formatDuration(demo.baseline.steps[warnStep].t1RunwayMin))).toBeInTheDocument()

    chooseScenario('With Lifeline')
    expect(runway()).not.toHaveAttribute('data-level', 'warn')
  })

  test('a room opens its equipment with Enter and closes with Escape', () => {
    renderOutage()
    const icu = screen.getByRole('button', { name: /^ICU: / })
    icu.focus()
    fireEvent.keyDown(icu, { key: 'Enter' })

    const dialog = screen.getByRole('dialog', { name: 'ICU equipment' })
    expect(within(dialog).getByText('ICU ventilator')).toBeInTheDocument()
    expect(within(dialog).getAllByText('Life-critical').length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText('Powered').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('1.0 kW')).toBeInTheDocument()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(icu).toHaveFocus()
  })

  test('diesel only at the first outage: no room is lit and none reads as paused', () => {
    renderOutage()
    chooseScenario('Today: diesel only')
    seek(firstOutageStep)

    const plan = screen.getByRole('group', { name: 'Hospital floor plan' })
    for (const room of roomButtons()) {
      expect(room.getAttribute('aria-label')).not.toMatch(/: (lit|paused|partly paused),/)
      expect(room.getAttribute('aria-label')).toMatch(/: no power,/)
    }
    expect(within(plan).queryByText('Paused')).not.toBeInTheDocument()
    expect(within(plan).queryByText('Partly paused')).not.toBeInTheDocument()
    // The theatre runs office hours only, so at night it is dark for want of power, not paused.
    expect(screen.getByRole('button', { name: /^Theatre: no power,/ })).toBeInTheDocument()
  })

  test('with Lifeline, loads it sheds still read as paused', () => {
    expect(demo.lifeline.steps[firstOutageStep].shedT3).toBe(true)
    renderOutage()
    seek(firstOutageStep)
    const plan = screen.getByRole('group', { name: 'Hospital floor plan' })
    expect(screen.getByRole('button', { name: /^Wards: partly paused,/ })).toBeInTheDocument()
    expect(within(plan).getByText('Partly paused')).toBeInTheDocument()
    expect(within(plan).queryByText('No power')).not.toBeInTheDocument()
  })

  test('opening another room moves focus into its popover', () => {
    renderOutage()
    const icu = screen.getByRole('button', { name: /^ICU: / })
    icu.focus()
    fireEvent.keyDown(icu, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    const theatre = screen.getByRole('button', { name: /^Theatre: / })
    theatre.focus()
    fireEvent.keyDown(theatre, { key: 'Enter' })
    const dialog = screen.getByRole('dialog', { name: 'Theatre equipment' })
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(theatre).toHaveFocus()
  })

  test('headings never skip a level, also with a room popover open', () => {
    renderOutage()
    fireEvent.click(screen.getByRole('button', { name: /^Admin: / }))
    expect(screen.getByRole('dialog', { name: 'Admin equipment' })).toBeInTheDocument()

    const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName.slice(1)))
    expect(levels[0]).toBe(1)
    levels.forEach((level, i) => {
      if (i > 0) expect(level).toBeLessThanOrEqual(levels[i - 1] + 1)
    })
  })

  test('the room popover marks unpowered life-critical items and idle ones', () => {
    renderOutage()
    chooseScenario('Today: diesel only')
    seek(firstOutageStep)
    fireEvent.click(screen.getByRole('button', { name: /^Theatre: / }))
    const theatre = screen.getByRole('dialog', { name: 'Theatre equipment' })
    // The theatre runs office hours only, so at night nothing in it is in use.
    expect(within(theatre).getAllByText('Not in use now').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: /^ICU: / }))
    expect(within(screen.getByRole('dialog', { name: 'ICU equipment' })).getAllByText('No power').length).toBeGreaterThan(0)
  })

  test('the chart has a summary for screen readers', () => {
    renderOutage()
    const downSteps = demo.grid.up.filter((up) => !up).length
    const summary = `Load through the day. Grid off for ${downSteps / 4} hours in 3 blocks.`
    expect(screen.getByRole('img', { name: `${summary} Life-critical load served all day.` })).toBeInTheDocument()

    chooseScenario('Today: diesel only')
    expect(
      screen.getByRole('img', {
        name: `${summary} Life-critical load unserved for ${formatDuration(demo.baseline.metrics.t1MinutesUnpowered)}.`,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(25)
  })

  test('the event log lists events so far, newest first', () => {
    renderOutage()
    const log = screen.getByRole('region', { name: 'Event log' })
    const list = within(log).getByRole('list')
    expect(list).toHaveAttribute('aria-live', 'polite')
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0)

    seek(95)
    const items = within(list).getAllByRole('listitem')
    const events = demo.lifeline.events
    expect(items).toHaveLength(events.length)
    expect(items[0]).toHaveTextContent(stepToClock(events[events.length - 1].step))
    expect(items[0]).toHaveTextContent('Grid power is back.')
    expect(items[items.length - 1]).toHaveTextContent(stepToClock(events[0].step))
    expect(items[items.length - 1]).toHaveTextContent('Grid lost. ICU covered for')

    const toggle = within(log).getByRole('button', { name: `Event log (${events.length})` })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('New day picks a new seed and goes back to 00:00; the season does not', () => {
    renderOutage()
    seek(40)
    fireEvent.click(screen.getByRole('radio', { name: 'Rainy season' }))
    expect(scrubber()).toHaveValue('40')

    fireEvent.click(screen.getByRole('button', { name: 'New day' }))
    expect(screen.getByTestId('seed')).not.toHaveTextContent(String(DEMO_SEED))
    expect(Number(screen.getByTestId('seed').textContent)).toBeGreaterThan(0)
    expect(scrubber()).toHaveValue('0')
  })

  test('the page never shows NaN, Infinity, undefined or tier codes', () => {
    renderOutage()
    for (const scenario of ['With Lifeline', 'Today: diesel only'] as const) {
      chooseScenario(scenario)
      for (const step of [0, 40, 95]) {
        seek(step)
        const text = document.body.textContent ?? ''
        expect(text).not.toMatch(/NaN|Infinity|undefined|\bT[123]\b/)
      }
    }
  })

  test('leaving the page mid-playback leaves no timers behind', () => {
    const { unmount } = renderOutage('#/outage?autoplay=1')
    advance(400 * 5)
    expect(scrubber()).toHaveValue('5')

    unmount()
    advance(1000)
    expect(vi.getTimerCount()).toBe(0)
  })
})
