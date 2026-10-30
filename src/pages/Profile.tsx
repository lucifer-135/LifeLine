import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Card } from '../components/Card'
import { NumberField } from '../components/NumberField'
import { SegmentedControl } from '../components/SegmentedControl'
import { Slider } from '../components/Slider'
import { TierBadge } from '../components/TierBadge'
import { EQUIPMENT_LIBRARY, equipmentId } from '../data/equipment'
import type { EquipmentTemplate } from '../data/equipment'
import { PRESETS } from '../data/presets'
import { SOLAR_SITES } from '../data/solarSites'
import { buildLoadProfile } from '../engine/loads'
import type { Equipment, Ward } from '../engine/types'
import { useApp } from '../state/AppState'
import { useHashRoute } from '../state/useHashRoute'
import './Profile.css'

const PRESET_OPTIONS = PRESETS.map((preset) => ({ value: preset.id, label: preset.name }))

// The 36 states and the FCT, A to Z. The names come from SOLAR_SITES so the list
// can never offer a state the solar model has no data for.
const STATES = Object.values(SOLAR_SITES)
  .map((site) => site.state)
  .sort((a, b) => a.localeCompare(b))

// Most critical care first. Wards with no equipment are not shown.
const WARDS: { ward: Ward; name: string }[] = [
  { ward: 'ICU', name: 'ICU' },
  { ward: 'Theatre', name: 'Theatre' },
  { ward: 'Maternity', name: 'Maternity' },
  { ward: 'ColdChain', name: 'Cold chain' },
  { ward: 'Lab', name: 'Lab' },
  { ward: 'Wards', name: 'Wards' },
  { ward: 'Utilities', name: 'Utilities' },
  { ward: 'Admin', name: 'Admin' },
]

// Stable ids so an error can move focus to the field it names.
const FIELD_IDS = {
  state: 'profile-state',
  beds: 'profile-beds',
  gridHours: 'profile-grid-hours',
  diesel: 'profile-diesel',
  generator: 'profile-generator',
  addEquipment: 'profile-add-equipment',
}

type ItemField = 'watts' | 'duty' | 'qty'

const itemFieldId = (itemId: string, field: ItemField) => `profile-${itemId}-${field}`
const removeButtonId = (itemId: string) => `profile-${itemId}-remove`

// Profile-level messages from validateProfile, matched by the start of the text.
const PROFILE_ERROR_FIELDS: [startsWith: string, fieldId: string][] = [
  ['Beds must', FIELD_IDS.beds],
  ['Grid hours must', FIELD_IDS.gridHours],
  ['Diesel must', FIELD_IDS.diesel],
  ['Generator size must', FIELD_IDS.generator],
  ['Add at least one life-critical item.', FIELD_IDS.addEquipment],
]

// The field an error is about, or null when it belongs to a field on another page
// (the cost assumptions). Item messages read "{name}: {problem}".
function fieldForError(message: string, equipment: Equipment[]): string | null {
  const profileField = PROFILE_ERROR_FIELDS.find(([startsWith]) => message.startsWith(startsWith))
  if (profileField) return profileField[1]

  const item = equipment.find((e) => message.startsWith(`${e.name}: `))
  if (!item) return null
  if (message.includes('duty cycle')) return itemFieldId(item.id, 'duty')
  if (message.includes('quantity')) return itemFieldId(item.id, 'qty')
  return itemFieldId(item.id, 'watts')
}

// The id may sit on the control itself or on the element that wraps it.
function focusField(id: string) {
  const target = document.getElementById(id)
  const control = target?.matches('input, select') ? target : target?.querySelector('input, select')
  if (control instanceof HTMLElement) control.focus()
}

// Shown as 0-100, stored as 0-1. Rounding hides float noise (0.07 * 100 is
// 7.000000000000001) without cutting off digits a person typed.
const toPercent = (fraction: number) => Math.round(fraction * 1e6) / 1e4

// Same kebab-case id as the presets use, with -2, -3... when the profile already has one.
function nextEquipmentId(name: string, equipment: Equipment[]): string {
  const base = equipmentId(name)
  const taken = new Set(equipment.map((e) => e.id))
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return id
}

function summarize(equipment: Equipment[]) {
  const { kw, dailyKwh } = buildLoadProfile(equipment)
  // The peak is for the whole hospital, so the three tiers are added step by step.
  const peakKw = Math.max(0, ...kw.T1.map((life, step) => life + kw.T2[step] + kw.T3[step]))
  return { dailyKwh, peakKw }
}

function AddEquipment({ onAdd }: { onAdd: (template: EquipmentTemplate) => void }) {
  const [name, setName] = useState(EQUIPMENT_LIBRARY[0].name)

  function add() {
    const template = EQUIPMENT_LIBRARY.find((item) => item.name === name)
    if (template) onAdd(template)
  }

  return (
    <div className="profile-add">
      <div className="profile-field">
        <label htmlFor={FIELD_IDS.addEquipment} className="profile-field__label">
          Add equipment
        </label>
        <select
          id={FIELD_IDS.addEquipment}
          className="profile-select"
          value={name}
          onChange={(event) => setName(event.target.value)}
        >
          {EQUIPMENT_LIBRARY.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <button type="button" className="button button--secondary" onClick={add}>
        <Plus size={16} />
        Add
      </button>
    </div>
  )
}

interface EquipmentRowProps {
  item: Equipment
  onChange: (patch: Partial<Equipment>) => void
  onRemove: () => void
}

function EquipmentRow({ item, onChange, onRemove }: EquipmentRowProps) {
  // The column headers label these fields on a wide screen. When rows stack
  // they have no header above them, so each cell shows its own visible label.
  // The explicit roles are for the stacked layout: see the table in Profile.
  return (
    <tr className="equipment-row" role="row">
      <th scope="row" role="rowheader" className="equipment-row__name">
        {item.name}
      </th>
      <td role="cell" className="equipment-row__priority">
        <TierBadge tier={item.tier} />
      </td>
      <td id={itemFieldId(item.id, 'watts')} role="cell" className="equipment-row__field">
        <span className="equipment-row__label" aria-hidden="true">
          Watts
        </span>
        <NumberField
          label={`${item.name} watts`}
          hideLabel
          compact
          min={1}
          value={item.ratedW}
          onChange={(ratedW) => onChange({ ratedW })}
        />
      </td>
      <td id={itemFieldId(item.id, 'duty')} role="cell" className="equipment-row__field">
        <span className="equipment-row__label" aria-hidden="true">
          Duty
        </span>
        <NumberField
          label={`${item.name} duty`}
          hideLabel
          compact
          min={0}
          max={100}
          suffix="%"
          value={toPercent(item.dutyCycle)}
          onChange={(percent) => onChange({ dutyCycle: percent / 100 })}
        />
      </td>
      <td id={itemFieldId(item.id, 'qty')} role="cell" className="equipment-row__field">
        <span className="equipment-row__label" aria-hidden="true">
          Qty
        </span>
        <NumberField
          label={`${item.name} quantity`}
          hideLabel
          compact
          min={0}
          step={1}
          value={item.qty}
          onChange={(qty) => onChange({ qty })}
        />
      </td>
      <td role="cell" className="equipment-row__remove">
        <button
          id={removeButtonId(item.id)}
          type="button"
          className="button button--secondary"
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <Trash2 size={16} />
          Remove
        </button>
      </td>
    </tr>
  )
}

export function Profile() {
  const { state, dispatch, errors } = useApp()
  const { navigate } = useHashRoute()
  const { profile } = state
  const pageRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  // Computed here, not taken from the comparison: the comparison is null while
  // the profile is invalid, and the summary should keep tracking each edit.
  const { dailyKwh, peakKw } = useMemo(() => summarize(profile.equipment), [profile.equipment])

  // The dock grows when errors appear. Fields need to know its height so that
  // focus scrolls them clear of it (DESIGN §10: sticky UI never covers a focused control).
  useEffect(() => {
    const page = pageRef.current
    const dock = dockRef.current
    if (!page || !dock) return
    const publishHeight = () => page.style.setProperty('--dock-h', `${dock.offsetHeight}px`)
    publishHeight()
    const observer = new ResizeObserver(publishHeight)
    observer.observe(dock)
    return () => observer.disconnect()
  }, [])

  const groups = WARDS.map(({ ward, name }) => ({
    ward,
    name,
    items: profile.equipment.filter((item) => item.ward === ward),
  })).filter((group) => group.items.length > 0)

  function addEquipment(template: EquipmentTemplate) {
    dispatch({
      type: 'addEquipment',
      item: {
        ...template,
        // The library is shared module data; the profile gets its own schedule.
        scheduleMask: [...template.scheduleMask],
        qty: 1,
        id: nextEquipmentId(template.name, profile.equipment),
      },
    })
  }

  // The removed row held focus. Move it to the next row's Remove, else the previous
  // row's, else the add control, so it does not drop to <body>. flushSync renders the
  // removal first, so the target is in its final place when it takes focus.
  function removeEquipment(itemId: string) {
    const rows = groups.flatMap((group) => group.items)
    const index = rows.findIndex((row) => row.id === itemId)
    const neighbour = rows[index + 1] ?? rows[index - 1]
    flushSync(() => dispatch({ type: 'removeEquipment', id: itemId }))
    document.getElementById(neighbour ? removeButtonId(neighbour.id) : FIELD_IDS.addEquipment)?.focus()
  }

  function chooseState(name: string) {
    const next = STATES.find((candidate) => candidate === name)
    if (next) dispatch({ type: 'updateProfile', patch: { state: next } })
  }

  // The same text can come from two items with the same name; show it once.
  const uniqueErrors = [...new Set(errors)]
  const hasEquipment = profile.equipment.length > 0

  return (
    <div className="profile-page" ref={pageRef}>
      <div className="container profile">
        <h1>Hospital profile</h1>

        <div className="profile-start">
          <span className="profile-start__label" aria-hidden="true">
            Start from
          </span>
          <SegmentedControl
            label="Start from"
            options={PRESET_OPTIONS}
            value={profile.id}
            onChange={(presetId) => dispatch({ type: 'loadPreset', presetId })}
          />
        </div>

        <div className="profile-panels">
          <Card as="section" aria-labelledby="profile-site-title">
            <h2 id="profile-site-title">Site</h2>
            <div className="profile-fields profile-fields--pair">
              <div className="profile-field">
                <label htmlFor={FIELD_IDS.state} className="profile-field__label">
                  State
                </label>
                <select
                  id={FIELD_IDS.state}
                  className="profile-select"
                  value={profile.state}
                  onChange={(event) => chooseState(event.target.value)}
                >
                  {STATES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div id={FIELD_IDS.beds}>
                <NumberField
                  label="Beds"
                  min={1}
                  step={1}
                  value={profile.beds}
                  onChange={(beds) => dispatch({ type: 'updateProfile', patch: { beds } })}
                />
              </div>
            </div>
          </Card>

          <Card as="section" aria-labelledby="profile-power-title">
            <h2 id="profile-power-title">Power today</h2>
            <div className="profile-fields">
              <div id={FIELD_IDS.gridHours}>
                <Slider
                  label="Grid hours a day"
                  min={0}
                  max={24}
                  step={0.5}
                  value={profile.gridHoursPerDay}
                  format={(hours) => `${hours} h`}
                  onChange={(gridHoursPerDay) => dispatch({ type: 'updateProfile', patch: { gridHoursPerDay } })}
                />
              </div>
              <div className="profile-fields profile-fields--pair">
                <div id={FIELD_IDS.diesel}>
                  <NumberField
                    label="Diesel per month"
                    min={0}
                    suffix="litres"
                    value={profile.dieselLitresPerMonth}
                    onChange={(dieselLitresPerMonth) =>
                      dispatch({ type: 'updateProfile', patch: { dieselLitresPerMonth } })
                    }
                  />
                </div>
                <div id={FIELD_IDS.generator}>
                  <NumberField
                    label="Generator size"
                    min={0}
                    suffix="kVA"
                    value={profile.generatorKva}
                    onChange={(generatorKva) => dispatch({ type: 'updateProfile', patch: { generatorKva } })}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <section className="profile-equipment" aria-labelledby="profile-equipment-title">
          <div className="profile-equipment__head">
            <h2 id="profile-equipment-title">Equipment</h2>
            {hasEquipment ? <AddEquipment onAdd={addEquipment} /> : null}
          </div>

          {hasEquipment ? (
            // Below 768px the rows are restyled as blocks (Profile.css), and Safari then
            // drops the table semantics. The explicit roles keep them.
            <table className="equipment-table" role="table">
              <caption className="visually-hidden">
                Equipment by ward, with priority, power in watts, share of time in use and quantity
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">Item</th>
                  <th scope="col" role="columnheader">Priority</th>
                  <th scope="col" role="columnheader">Watts</th>
                  <th scope="col" role="columnheader">Duty</th>
                  <th scope="col" role="columnheader">Qty</th>
                  <th scope="col" role="columnheader">
                    <span className="visually-hidden">Remove</span>
                  </th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.ward} role="rowgroup">
                  <tr className="equipment-table__ward-row" role="row">
                    <th scope="rowgroup" role="rowheader" colSpan={6}>
                      {group.name}
                    </th>
                  </tr>
                  {group.items.map((item) => (
                    <EquipmentRow
                      key={item.id}
                      item={item}
                      onChange={(patch) => dispatch({ type: 'updateEquipment', id: item.id, patch })}
                      onRemove={() => removeEquipment(item.id)}
                    />
                  ))}
                </tbody>
              ))}
            </table>
          ) : (
            <>
              <p className="profile-equipment__empty">
                No equipment yet. Add the machines that must never lose power first.
              </p>
              <AddEquipment onAdd={addEquipment} />
            </>
          )}
        </section>
      </div>

      <div className="profile-dock" ref={dockRef}>
        <div className="container profile-dock__inner">
          {uniqueErrors.length > 0 ? (
            <div className="profile-errors" role="alert">
              <ul>
                {uniqueErrors.map((message) => {
                  const fieldId = fieldForError(message, profile.equipment)
                  return (
                    <li key={message}>
                      {fieldId ? (
                        // A real link would need href="#id", which the hash router reads as a route.
                        <button type="button" className="link-like" onClick={() => focusField(fieldId)}>
                          {message}
                        </button>
                      ) : (
                        message
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          <div className="profile-summary">
            <p className="profile-summary__text">
              {`Daily use: life-critical ${dailyKwh.T1.toFixed(1)} kWh, essential ${dailyKwh.T2.toFixed(1)} kWh, can wait ${dailyKwh.T3.toFixed(1)} kWh. Peak ${peakKw.toFixed(1)} kW.`}
            </p>
            <button
              type="button"
              className="button button--primary"
              disabled={errors.length > 0}
              onClick={() => navigate('outage')}
            >
              Run outage day
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
