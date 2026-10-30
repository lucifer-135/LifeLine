import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { SOURCES } from '../data/sources'
import type { Source } from '../data/sources'
import {
  BATTERY_DOD,
  BATTERY_RESERVE_SOC,
  BATTERY_ROUND_TRIP,
  INVERTER_HEADROOM,
  PV_PERFORMANCE_RATIO,
  PV_STRONG_END_HOUR,
  PV_STRONG_START_HOUR,
  STEP_HOURS,
} from '../engine/constants'
import { scrollToAnchor, useHashRoute } from '../state/useHashRoute'
import './Method.css'

// The engine constants are imported, not retyped, so this text cannot drift from the model.
const STEP_MINUTES = STEP_HOURS * 60
const RESERVE_PERCENT = `${Math.round(BATTERY_RESERVE_SOC * 100)}%`
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`
const STRONG_SUN_WINDOW = `${hourLabel(PV_STRONG_START_HOUR)}–${hourLabel(PV_STRONG_END_HOUR)}`

// Copy from DESIGN §6.4, verbatim.
const LIMITS = [
  'Simulates one representative day, not a full year.',
  'Equipment ratings are typical values, not a site audit. Field tests found real draw differs from labels by −45% to +56%.',
  'Prices were checked in October 2026 (diesel is the May 2026 NBS average) and change fast; edit them on the plan page.',
  'The grid outage pattern is generated, not measured. Real feeder data would replace it in a pilot.',
]

const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

// Thousands separators and no float noise. A calendar year ("2025") gets neither a
// separator nor a unit, and a ₦ unit moves in front of the figure, as "₦3,277/L".
function formatNumber({ value, unit }: Source): string {
  if (unit === 'year') return String(value)
  const figure = NUMBER_FORMAT.format(value)
  if (unit === '%') return `${figure}%`
  if (unit.startsWith('₦')) return `₦${figure}${unit.slice(1)}`
  return `${figure} ${unit}`
}

// An indented block in the body face, not code: the variables are words.
function Formula({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="method-formula">
      <span className="method-formula__name">{name}</span> = {children}
    </p>
  )
}

function SourceRow({ source, number, isTarget }: { source: Source; number: number; isTarget: boolean }) {
  const hasDate = source.date !== '—'
  return (
    <tr id={`src-${source.id}`} className={isTarget ? 'source-row source-row--target' : 'source-row'}>
      <th scope="row" className="source-row__value">
        <span className="source-row__index">{number}</span> {source.label}
      </th>
      <td className="source-row__number">{formatNumber(source)}</td>
      <td className="source-row__source">
        {source.url === '' ? (
          source.source
        ) : (
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            {source.source}
          </a>
        )}
        {hasDate ? <span className="source-row__date">{source.date}</span> : null}
      </td>
      <td className="source-row__estimate">
        {source.isEstimate ? <span className="source-tag">Estimate</span> : null}
      </td>
    </tr>
  )
}

export function Method() {
  // CSS :target cannot see an anchor inside a hash route, so the page marks the row itself.
  const { anchor } = useHashRoute()

  // App scrolls to the row as soon as the page mounts, but the web fonts arrive a moment
  // later and reflow the text above it. On a first visit that can leave the row under the
  // sticky nav, so scroll once more when the fonts are in. Where the font set does not
  // exist (jsdom) the first scroll stands.
  useEffect(() => {
    if (anchor === null || !('fonts' in document)) return
    let isCurrent = true
    void document.fonts.ready.then(() => {
      if (isCurrent) scrollToAnchor(anchor)
    })
    return () => {
      isCurrent = false
    }
  }, [anchor])

  return (
    <div className="container method">
      <div className="method__column">
        <header className="method__intro">
          <h1>Method & sources</h1>
          <p>
            How Lifeline turns a hospital’s equipment list into a system size, a day of
            outages and a monthly fee, and where each number comes from.
          </p>
        </header>

        <section className="method-section" aria-labelledby="method-sizing">
          <h2 id="method-sizing">How sizing works</h2>
          <p>
            Lifeline sizes for the load it must keep on: life-critical plus essential. Loads that
            can wait are not sized for, because the controller pauses them first.
          </p>
          <Formula name="Battery size">
            night energy × outage share of the night ÷ ({BATTERY_DOD} usable × {BATTERY_ROUND_TRIP}{' '}
            round trip), rounded up to the next 5 kWh
          </Formula>
          <Formula name="Solar size">
            daily energy × share of the day without grid ÷ {BATTERY_ROUND_TRIP} round trip ÷
            (worst-month sun hours × {PV_PERFORMANCE_RATIO} performance ratio), rounded up to the
            next 1 kWp
          </Formula>
          <Formula name="Inverter size">
            {INVERTER_HEADROOM} × peak load, rounded up to the next 1 kW
          </Formula>
          <p>
            Every energy and load figure above counts only life-critical and essential load. Night
            energy is what that load uses between sunset and sunrise. The outage share of the night
            is the smaller of 1 and the longest outage ÷ the night hours.
          </p>
          <p>
            Solar covers the daytime part of an outage, so the battery only has to cover the night.
            Solar is sized for the month with the least sun in the hospital’s state (August in
            most states, when the rains are heaviest).
          </p>
          <p>
            The {BATTERY_DOD} usable, {BATTERY_ROUND_TRIP} round trip, {PV_PERFORMANCE_RATIO}{' '}
            performance ratio and {INVERTER_HEADROOM} headroom factors and the {RESERVE_PERCENT}{' '}
            battery reserve are model settings, not sourced values, so they are not in the Sources
            table.
          </p>
        </section>

        <section className="method-section" aria-labelledby="method-controller">
          <h2 id="method-controller">How the controller decides</h2>
          <p>
            The simulation steps through one day in {STEP_MINUTES}-minute steps. It runs the day
            twice and shows the second run, so the battery starts at a realistic charge.
          </p>
          <h3>With Lifeline</h3>
          <ul className="method-list">
            <li>
              With the grid up, everything is served. The battery charges from spare solar first,
              then from the grid.
            </li>
            <li>
              In an outage, the controller looks ahead to the next time the grid returns or the sun
              is strong ({STRONG_SUN_WINDOW}). It compares the energy the loads need after solar until
              then with the battery energy above a {RESERVE_PERCENT} reserve.
            </li>
            <li>
              If the battery cannot carry everything, it pauses loads that can wait first, then
              essential loads. It brings them back only when there is a 20% margin. Life-critical
              load is never paused.
            </li>
            <li>
              Power comes from solar first, then the battery down to its reserve, then the
              generator, and last the battery’s reserve. The generator is kept for
              emergencies.
            </li>
          </ul>
          <h3>Today: diesel only</h3>
          <p>
            Each outage starts with a {STEP_MINUTES}-minute gap while the generator is started by
            hand. After that the generator serves life-critical load first, up to its rating, then
            the rest, until the fuel runs out.
          </p>
        </section>

        <section className="method-section" aria-labelledby="method-money">
          <h2 id="method-money">How the money works</h2>
          <p>
            Daily energy cost is the grid energy × the grid tariff plus the diesel litres × the
            diesel price, for the simulated day.
          </p>
          <Formula name="Today’s annual spend">daily energy cost × 365 + generator maintenance</Formula>
          <Formula name="Upfront cost">
            (solar size × solar price + battery size × battery price + inverter size × inverter
            price) × (1 + balance of system)
          </Formula>
          <Formula name="Monthly fee">fee share × today’s annual spend ÷ 12</Formula>
          <Formula name="Hospital saves per year">today’s annual spend − 12 × monthly fee</Formula>
          <Formula name="Provider cash flow per year">
            12 × monthly fee − (leftover grid and diesel cost × 365 + O&M share × upfront cost)
          </Formula>
          <Formula name="Payback">upfront cost ÷ provider cash flow per year</Formula>
          <Formula name="Return (IRR)">
            the yearly rate at which −upfront cost plus the provider cash flow of each contract
            year, discounted at that rate, adds up to zero
          </Formula>
          <p>
            The provider pays the leftover grid and diesel and the operations and maintenance. That
            is the Energy-as-a-Service guarantee: the hospital pays the monthly fee and the provider
            carries the rest. When the provider has no positive cash flow, payback and return show
            n/a.
          </p>
        </section>

        <section className="method-section" aria-labelledby="method-sources">
          <h2 id="method-sources">Sources</h2>
          <p>
            A small superscript number next to a figure anywhere in Lifeline links to its row below.
            Rows tagged Estimate are planning values, not measurements.
          </p>
          <table className="sources-table">
            <caption className="caption">Sourced values in Lifeline, with their source and date</caption>
            <thead>
              <tr>
                <th scope="col">Value</th>
                <th scope="col" className="sources-table__number-head">
                  Number
                </th>
                <th scope="col">Source and date</th>
                <th scope="col">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((source, index) => (
                <SourceRow
                  key={source.id}
                  source={source}
                  number={index + 1}
                  isTarget={anchor === `src-${source.id}`}
                />
              ))}
            </tbody>
          </table>
        </section>

        <section className="method-section" aria-labelledby="method-limits">
          <h2 id="method-limits">Limits</h2>
          <ul className="method-list">
            {LIMITS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
