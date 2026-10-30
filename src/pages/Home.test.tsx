import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { HOME_STATS } from '../data/stats'
import { DEMO_SEED } from '../engine/constants'
import { AppProvider, useApp } from '../state/AppState'
import { Home } from './Home'

// motion reads the reduced-motion query once, on the first useReducedMotion()
// call, then only updates when the query fires 'change'. So the query is
// installed at file scope, before any render, and tests flip it through
// setReducedMotion() instead of re-mocking matchMedia per test.
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

const CAPTION = 'Battery took over. No gap.'
const KANO_SENTENCE =
  'In 2025, a prolonged outage at Aminu Kano Teaching Hospital was linked to deaths in its intensive care unit.'

// Shows the state Home writes, and moves it away from the demo defaults so a
// test can see the primary call to action reset it.
function StateProbe() {
  const { state, dispatch } = useApp()
  const leaveDemo = () => {
    dispatch({ type: 'loadPreset', presetId: 'phc' })
    dispatch({ type: 'setSeed', seed: 7 })
  }
  return (
    <>
      <output data-testid="preset">{state.profile.id}</output>
      <output data-testid="seed">{state.seed}</output>
      <button type="button" onClick={leaveDemo}>
        Leave the demo state
      </button>
    </>
  )
}

function renderHome() {
  return render(
    <AppProvider>
      <Home />
      <StateProbe />
    </AppProvider>,
  )
}

function statStrip(): HTMLElement {
  const section = screen.getByRole('region', { name: 'Why it matters' })
  return within(section).getByRole('list')
}

// replaceState does not fire `hashchange`, so each test starts from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

afterEach(() => setReducedMotion(false))

describe('Home', () => {
  test('hero heading', () => {
    renderHome()
    expect(
      screen.getByRole('heading', { level: 1, name: 'No hospital should go dark.' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  test('primary CTA goes to outage with autoplay', () => {
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: 'Leave the demo state' }))
    expect(screen.getByTestId('preset')).toHaveTextContent('phc')
    expect(screen.getByTestId('seed')).toHaveTextContent('7')

    fireEvent.click(screen.getByRole('button', { name: 'Simulate an outage' }))

    expect(window.location.hash).toBe('#/outage?autoplay=1')
    expect(screen.getByTestId('preset')).toHaveTextContent('kano-50')
    expect(screen.getByTestId('seed')).toHaveTextContent(String(DEMO_SEED))
  })

  test('stat strip shows 3 stats with sources', () => {
    renderHome()
    const items = within(statStrip()).getAllByRole('listitem')
    expect(items).toHaveLength(3)

    HOME_STATS.forEach((stat, i) => {
      const item = items[i]
      expect(item).toHaveTextContent(stat.before.trim())
      expect(item).toHaveTextContent(stat.after.trim())
      expect(within(item).getByText(String(stat.value), { selector: '.visually-hidden' })).toBeInTheDocument()
      expect(within(item).getByRole('link')).toHaveAttribute('href', `#/method#src-${stat.sourceId}`)
    })
    expect(within(statStrip()).getAllByRole('link')).toHaveLength(3)
  })

  test('the Kano sentence is sourced and stays outside the stat strip', () => {
    renderHome()
    const kano = screen.getByText(KANO_SENTENCE)
    expect(statStrip()).not.toContainElement(kano)
    expect(within(kano).getByRole('link')).toHaveAttribute('href', '#/method#src-stat.kanoIcu')
  })

  test('"Size my hospital" links to the hospital profile', () => {
    renderHome()
    expect(screen.getByRole('link', { name: 'Size my hospital' })).toHaveAttribute('href', '#/profile')
  })

  test('the footer links to the method and sources', () => {
    renderHome()
    expect(screen.getByRole('link', { name: 'method and sources' })).toHaveAttribute('href', '#/method')
  })

  test('the blackout caption appears only after the blackout plays', () => {
    renderHome()
    expect(screen.getByText(CAPTION)).not.toBeVisible()
  })

  test('with reduced motion the hero shows its final state at once', () => {
    setReducedMotion(true)
    renderHome()
    expect(screen.getByText(CAPTION)).toBeVisible()
  })
})
