import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { EQUIPMENT_LIBRARY } from '../data/equipment'
import { PRESETS } from '../data/presets'
import { buildLoadProfile } from '../engine/loads'
import { AppProvider, useApp } from '../state/AppState'
import { Profile } from './Profile'

// Shows the equipment state the page writes, so a test can look past the DOM.
function StateProbe() {
  const { state } = useApp()
  return (
    <output data-testid="equipment">
      {JSON.stringify(state.profile.equipment.map(({ id, qty, dutyCycle }) => ({ id, qty, dutyCycle })))}
    </output>
  )
}

function renderProfile() {
  return render(
    <AppProvider>
      <Profile />
      <StateProbe />
    </AppProvider>,
  )
}

// replaceState does not fire `hashchange`, so each test starts from a clean URL.
beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

function summaryText(): string {
  const summary = screen.getByText(/^Daily use:/).textContent
  if (summary === null) throw new Error('The summary bar has no text')
  return summary
}

function lifeCriticalKwh(): number {
  const match = /life-critical ([\d.]+) kWh/.exec(summaryText())
  if (!match) throw new Error(`No life-critical figure in: ${summaryText()}`)
  return Number(match[1])
}

function runButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Run outage day' })
}

// The table row that holds a given item's quantity field.
function rowOf(itemName: string): HTMLElement {
  const row = screen.getByLabelText(`${itemName} quantity`).closest('tr')
  if (!row) throw new Error(`No row for ${itemName}`)
  return row
}

function removeAllLifeCritical() {
  for (let badge = screen.queryAllByText('Life-critical')[0]; badge; badge = screen.queryAllByText('Life-critical')[0]) {
    const row = badge.closest('tr')
    if (!row) throw new Error('A priority badge sits outside a table row')
    fireEvent.click(within(row).getByRole('button', { name: /^Remove / }))
  }
}

describe('Profile', () => {
  test('has one h1 and loads the demo hospital', () => {
    renderProfile()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Hospital profile' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'General Hospital, Kano (50 beds)' })).toBeChecked()
    expect(screen.getByLabelText('State')).toHaveValue('Kano')
    expect(screen.getByLabelText('Beds')).toHaveValue(50)
    expect(screen.getByLabelText('Diesel per month')).toHaveValue(1500)
    expect(screen.getByLabelText('Generator size')).toHaveValue(60)
    expect(screen.getByLabelText('Grid hours a day')).toHaveValue('6')
    expect(screen.getByText('6 h')).toBeInTheDocument()
  })

  test('the grid hours slider updates the profile', () => {
    renderProfile()
    fireEvent.change(screen.getByLabelText('Grid hours a day'), { target: { value: '12.5' } })
    expect(screen.getByText('12.5 h')).toBeInTheDocument()
  })

  test('state select lists 37 states', () => {
    renderProfile()
    const names = within(screen.getByLabelText('State'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(names).toHaveLength(37)
    expect(names).toEqual([...names].sort((a, b) => (a ?? '').localeCompare(b ?? '')))
    expect(names[0]).toBe('Abia')
    expect(names).toContain('FCT')
  })

  test('changing ventilator qty updates daily kWh summary', () => {
    renderProfile()
    const before = lifeCriticalKwh()
    expect(before).toBeCloseTo(109.8, 1)

    const quantity = screen.getByLabelText('ICU ventilator quantity')
    expect(quantity).toHaveValue(4)
    fireEvent.change(quantity, { target: { value: '8' } })

    // 250 W x 4 more x 24 h
    expect(lifeCriticalKwh()).toBeCloseTo(before + 24, 5)
  })

  test('the summary reports every tier and the peak of the whole hospital', () => {
    renderProfile()
    const { kw, dailyKwh } = buildLoadProfile(PRESETS[0].equipment)
    const peak = Math.max(...kw.T1.map((_, step) => kw.T1[step] + kw.T2[step] + kw.T3[step]))
    expect(summaryText()).toBe(
      `Daily use: life-critical ${dailyKwh.T1.toFixed(1)} kWh, essential ${dailyKwh.T2.toFixed(1)} kWh, ` +
        `can wait ${dailyKwh.T3.toFixed(1)} kWh. Peak ${peak.toFixed(1)} kW.`,
    )
  })

  test('duty is shown as a percentage and stored as a fraction', () => {
    renderProfile()
    const before = lifeCriticalKwh()
    const duty = screen.getByLabelText('ICU ventilator duty')
    expect(duty).toHaveValue(100)

    fireEvent.change(duty, { target: { value: '50' } })

    expect(screen.getByLabelText('ICU ventilator duty')).toHaveValue(50)
    // 250 W x 4 x 24 h, half of it gone
    expect(lifeCriticalKwh()).toBeCloseTo(before - 12, 5)
    const stored = JSON.parse(screen.getByTestId('equipment').textContent ?? '[]') as { id: string; dutyCycle: number }[]
    expect(stored.find((item) => item.id === 'icu-ventilator')?.dutyCycle).toBe(0.5)
  })

  test('removing all life-critical items shows an error and disables run', () => {
    renderProfile()
    expect(runButton()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    removeAllLifeCritical()

    expect(screen.getByRole('alert')).toHaveTextContent('Add at least one life-critical item.')
    expect(runButton()).toBeDisabled()
    // The summary stays live while the engine is blocked.
    expect(summaryText()).toContain('life-critical 0.0 kWh')
  })

  test('removing the last item shows the empty state with the add control', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('radio', { name: 'Primary Health Centre, FCT' }))
    const names = screen.getAllByRole('button', { name: /^Remove / }).map((b) => b.getAttribute('aria-label'))
    for (const name of names) fireEvent.click(screen.getByRole('button', { name: name ?? '' }))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      screen.getByText('No equipment yet. Add the machines that must never lose power first.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Add equipment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  test('choosing the PHC preset swaps the hospital and the table', () => {
    renderProfile()
    expect(screen.getByLabelText('ICU ventilator quantity')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Primary Health Centre, FCT' }))

    expect(screen.queryByLabelText('ICU ventilator quantity')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Vaccine refrigerator quantity')).toHaveValue(1)
    expect(screen.getByLabelText('State')).toHaveValue('FCT')
    expect(screen.getByLabelText('Beds')).toHaveValue(10)
    expect(screen.getByLabelText('Grid hours a day')).toHaveValue('8')
  })

  test('the table groups items by ward in clinical order, one body per ward', () => {
    renderProfile()
    const table = screen.getByRole('table')
    expect(within(table).getByText(/^Equipment by ward/, { selector: 'caption' })).toBeInTheDocument()

    const wards = within(table)
      .getAllByRole('rowgroup')
      .map((group) => group.querySelector('th[scope="rowgroup"]')?.textContent)
      .filter((name) => name !== undefined)
    expect(wards).toEqual(['ICU', 'Theatre', 'Maternity', 'Cold chain', 'Lab', 'Wards', 'Utilities', 'Admin'])

    expect(within(rowOf('ICU ventilator')).getByText('Life-critical')).toBeInTheDocument()
    expect(within(rowOf('ICU air conditioner')).getByText('Essential')).toBeInTheDocument()
    expect(within(rowOf('Ward ceiling fan')).getByText('Can wait')).toBeInTheDocument()
  })

  test('adding from the library adds a row with qty 1 and a unique id', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('radio', { name: 'Primary Health Centre, FCT' }))
    expect(screen.queryByLabelText('Autoclave quantity')).not.toBeInTheDocument()

    const select = screen.getByLabelText('Add equipment')
    expect(within(select).getAllByRole('option')).toHaveLength(EQUIPMENT_LIBRARY.length)
    fireEvent.change(select, { target: { value: 'Autoclave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByLabelText('Autoclave quantity')).toHaveValue(1)
    expect(screen.getByRole('button', { name: 'Remove Autoclave' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Theatre' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const ids = (JSON.parse(screen.getByTestId('equipment').textContent ?? '[]') as { id: string }[]).map((e) => e.id)
    expect(ids).toContain('autoclave')
    expect(ids).toContain('autoclave-2')
  })

  test('the library is not shared with the profile', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('radio', { name: 'Primary Health Centre, FCT' }))
    const library = EQUIPMENT_LIBRARY.find((item) => item.name === 'Autoclave')
    if (!library) throw new Error('Autoclave is missing from the library')
    const maskBefore = [...library.scheduleMask]

    fireEvent.change(screen.getByLabelText('Add equipment'), { target: { value: 'Autoclave' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByLabelText('Autoclave quantity'), { target: { value: '3' } })

    expect(library.scheduleMask).toEqual(maskBefore)
    expect(library).not.toHaveProperty('qty')
  })

  test('each error links to its field', () => {
    renderProfile()
    removeAllLifeCritical()
    fireEvent.click(screen.getByRole('button', { name: 'Add at least one life-critical item.' }))
    expect(screen.getByLabelText('Add equipment')).toHaveFocus()

    fireEvent.change(screen.getByLabelText('Beds'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Beds must be a whole number of 1 or more.' }))
    expect(screen.getByLabelText('Beds')).toHaveFocus()
  })

  test('an equipment error focuses the field it names', () => {
    renderProfile()
    fireEvent.change(screen.getByLabelText('ICU ventilator duty'), { target: { value: '150' } })

    fireEvent.click(screen.getByRole('button', { name: 'ICU ventilator: duty cycle must be between 0 and 1.' }))

    expect(screen.getByLabelText('ICU ventilator duty')).toHaveFocus()
    expect(runButton()).toBeDisabled()
  })

  test('Run outage day goes to the outage page', () => {
    renderProfile()
    fireEvent.click(runButton())
    expect(window.location.hash).toBe('#/outage')
  })
})
