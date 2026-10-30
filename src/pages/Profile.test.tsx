import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { EQUIPMENT_LIBRARY } from '../data/equipment'
import { PRESETS } from '../data/presets'
import { buildLoadProfile } from '../engine/loads'
import { AppProvider, useApp } from '../state/AppState'
import { Profile } from './Profile'

// Shows the equipment state the page writes, so a test can look past the DOM.
function StateProbe() {
  const { state, dispatch } = useApp()
  return (
    <>
      <output data-testid="equipment">
        {JSON.stringify(state.profile.equipment.map(({ id, qty, dutyCycle }) => ({ id, qty, dutyCycle })))}
      </output>
      <button type="button" onClick={() => dispatch({ type: 'updateCosts', patch: { dieselNgnPerLitre: -1 } })}>
        Break the costs
      </button>
    </>
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

// Why the longer timeout: each getByLabelText here checks every labelled control in a
// table of about 160 fields, which costs close to a second in jsdom (the engine run
// itself takes a few milliseconds). A test with three such queries takes about 2.5 s
// alone and passed the 5 s default when other test runs shared the CPU.
describe('Profile', { timeout: 15_000 }, () => {
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

  // On a phone the rows are restyled as blocks, and Safari then drops the table's
  // semantics. Explicit roles keep it announced as a table with headers and cells.
  test('the equipment table states its table roles explicitly', () => {
    renderProfile()
    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('role', 'table')
    const expectRole = (selector: string, role: string) => {
      const elements = table.querySelectorAll(selector)
      expect(elements.length).toBeGreaterThan(0)
      for (const element of elements) expect(element).toHaveAttribute('role', role)
    }
    expectRole('thead, tbody', 'rowgroup')
    expectRole('tr', 'row')
    expectRole('td', 'cell')
    expectRole('th[scope="col"]', 'columnheader')
    expectRole('th[scope="row"], th[scope="rowgroup"]', 'rowheader')

    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Item',
      'Priority',
      'Watts',
      'Duty',
      'Qty',
      'Remove',
    ])
    expect(within(rowOf('ICU ventilator')).getByRole('rowheader', { name: 'ICU ventilator' })).toBeInTheDocument()
    expect(within(rowOf('ICU ventilator')).getAllByRole('cell')).toHaveLength(5)
  })

  // The removed row held focus. Without a new home it would drop to <body>.
  test('after Remove, focus moves to the next row, else the previous row, else Add equipment', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('radio', { name: 'Primary Health Centre, FCT' }))
    const removeButtons = () => screen.getAllByRole('button', { name: /^Remove / })
    const buttonName = (button: HTMLElement) => button.getAttribute('aria-label') ?? ''

    const [first, second] = removeButtons()
    const nextName = buttonName(second)
    first.focus()
    fireEvent.click(first)
    expect(screen.getByRole('button', { name: nextName })).toHaveFocus()

    // The last row has no next row, so focus goes back one.
    const rows = removeButtons()
    const previous = rows[rows.length - 2]
    fireEvent.click(rows[rows.length - 1])
    expect(previous).toHaveFocus()

    // The last item leaves the empty state, whose add control takes focus.
    while (removeButtons().length > 1) fireEvent.click(removeButtons()[0])
    fireEvent.click(removeButtons()[0])
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Add equipment')).toHaveFocus()
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

  test('a cost error in the alert box links to the plan page, where it can be fixed', () => {
    renderProfile()
    fireEvent.click(screen.getByRole('button', { name: 'Break the costs' }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Diesel price must be zero or more.')
    expect(within(alert).getByRole('link', { name: 'Fix on the plan page' })).toHaveAttribute('href', '#/plan')
    expect(runButton()).toBeDisabled()
  })

  test('a profile error in the alert box has no plan page link', () => {
    renderProfile()
    removeAllLifeCritical()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Add at least one life-critical item.')
    expect(within(alert).queryByRole('link', { name: 'Fix on the plan page' })).not.toBeInTheDocument()
  })

  test('Run outage day goes to the outage page and starts playing', () => {
    renderProfile()
    fireEvent.click(runButton())
    expect(window.location.hash).toBe('#/outage?autoplay=1')
  })
})
