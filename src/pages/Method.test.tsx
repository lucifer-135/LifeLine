import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SOURCES } from '../data/sources'
import {
  BATTERY_DOD,
  BATTERY_ROUND_TRIP,
  INVERTER_HEADROOM,
  PV_PERFORMANCE_RATIO,
} from '../engine/constants'
import { Method } from './Method'

const DIESEL_ID = 'src-cost.dieselNgnPerLitre'
const FLASH_CLASS = 'source-row--target'

// replaceState does not fire `hashchange`, so each test starts from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

function sourceRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('tbody tr'))
}

function sectionOf(heading: string): HTMLElement {
  const section = screen.getByRole('heading', { level: 2, name: heading }).closest('section')
  if (!section) throw new Error(`The "${heading}" heading sits outside a section`)
  return section
}

describe('Method page structure', () => {
  test('has one h1 and the five sections in order', () => {
    render(<Method />)
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual([
      'Method & sources',
    ])
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'How sizing works',
      'How the controller decides',
      'How the money works',
      'Sources',
      'Limits',
    ])
  })

  test('sets formulas as plain text, never in a code font', () => {
    const { container } = render(<Method />)
    expect(container.querySelector('code, pre, kbd, samp')).toBeNull()
  })

  test('quotes the engine constants in the sizing formulas', () => {
    render(<Method />)
    const sizing = sectionOf('How sizing works').textContent ?? ''
    for (const constant of [BATTERY_DOD, BATTERY_ROUND_TRIP, PV_PERFORMANCE_RATIO, INVERTER_HEADROOM]) {
      expect(sizing).toContain(String(constant))
    }
  })

  test('explains the finance formulas with the Energy-as-a-Service guarantee', () => {
    render(<Method />)
    const money = sectionOf('How the money works').textContent ?? ''
    expect(money).toContain('365')
    expect(money).toContain('Energy-as-a-Service')
  })

  test('never shows the internal tier names', () => {
    const { container } = render(<Method />)
    expect(container.textContent).not.toMatch(/\bT[123]\b/)
  })
})

describe('Sources table', () => {
  test('renders exactly one row per source, each with its own anchor id', () => {
    const { container } = render(<Method />)
    const rows = sourceRows(container)
    expect(rows).toHaveLength(SOURCES.length)
    expect(rows.map((row) => row.id)).toEqual(SOURCES.map((source) => `src-${source.id}`))
  })

  test('is a real table with a caption and column headers', () => {
    render(<Method />)
    const table = screen.getByRole('table')
    expect(within(table).getByText(/every default number/i).tagName).toBe('CAPTION')
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((th) => th.textContent)).toEqual([
      'Value',
      'Number',
      'Source and date',
      'Estimate',
    ])
    for (const th of headers) expect(th).toHaveAttribute('scope', 'col')
  })

  test('the diesel price row carries its label and number', () => {
    render(<Method />)
    const row = document.getElementById(DIESEL_ID)
    expect(row).not.toBeNull()
    expect(row).toHaveTextContent('Diesel price')
    expect(row).toHaveTextContent('3,277')
  })

  test('numbers the rows to match the superscript marks', () => {
    const { container } = render(<Method />)
    const rows = sourceRows(container)
    const dieselIndex = SOURCES.findIndex((source) => `src-${source.id}` === DIESEL_ID)
    expect(within(rows[dieselIndex]).getByRole('rowheader')).toHaveTextContent(
      new RegExp(`^${dieselIndex + 1}\\s*Diesel price`),
    )
  })

  test('shows calendar years without a thousands separator', () => {
    render(<Method />)
    const row = document.getElementById('src-stat.kanoIcu')
    expect(row).toHaveTextContent('2025')
    expect(row).not.toHaveTextContent('2,025')
  })

  test('tags exactly the estimates', () => {
    const { container } = render(<Method />)
    const tagged = sourceRows(container).filter((row) => within(row).queryByText('Estimate'))
    const expected = SOURCES.filter((source) => source.isEstimate).map((s) => `src-${s.id}`)
    expect(tagged.map((row) => row.id)).toEqual(expected)
  })

  test('opens source links safely in a new tab, only where a link exists', () => {
    const { container } = render(<Method />)
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('tbody a'))
    expect(links).toHaveLength(SOURCES.filter((source) => source.url !== '').length)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.rel).toContain('noopener')
      expect(link.rel).toContain('noreferrer')
    }
  })
})

describe('anchor flash', () => {
  test('flashes only the row named by the hash anchor', () => {
    window.history.replaceState(null, '', `#/method#${DIESEL_ID}`)
    const { container } = render(<Method />)
    const flashing = sourceRows(container).filter((row) => row.classList.contains(FLASH_CLASS))
    expect(flashing.map((row) => row.id)).toEqual([DIESEL_ID])
  })

  test('flashes nothing without an anchor', () => {
    window.history.replaceState(null, '', '#/method')
    const { container } = render(<Method />)
    expect(container.querySelector(`.${FLASH_CLASS}`)).toBeNull()
  })

  test('ignores an anchor that matches no row', () => {
    window.history.replaceState(null, '', '#/method#src-nothing.here')
    const { container } = render(<Method />)
    expect(container.querySelector(`.${FLASH_CLASS}`)).toBeNull()
  })
})

describe('scroll after web fonts load', () => {
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    // jsdom has neither scrollIntoView nor a font set.
    Element.prototype.scrollIntoView = scrollIntoView
    Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true })
  })

  afterEach(() => {
    scrollIntoView.mockReset()
    Reflect.deleteProperty(document, 'fonts')
  })

  test('scrolls to the anchored row again once the fonts are ready', async () => {
    window.history.replaceState(null, '', `#/method#${DIESEL_ID}`)
    render(<Method />)
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById(DIESEL_ID))
  })

  test('does not scroll when there is no anchor', async () => {
    window.history.replaceState(null, '', '#/method')
    render(<Method />)
    await document.fonts.ready
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('Limits', () => {
  test('lists the four limits verbatim', () => {
    render(<Method />)
    const items = within(sectionOf('Limits')).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Simulates one representative day, not a full year.',
      'Equipment ratings are typical values, not a site audit. Field tests found real draw differs from labels by −45% to +56%.',
      'Prices are from October 2026 and change fast; edit them on the plan page.',
      'The grid outage pattern is generated, not measured. Real feeder data would replace it in a pilot.',
    ])
  })
})
