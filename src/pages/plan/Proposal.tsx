import { useId } from 'react'
import type { Comparison } from '../../engine/compare'
import type { CostAssumptions, FinanceResult, HospitalProfile, Season, TwinMetrics } from '../../engine/types'
import { formatDuration, formatNgn } from '../../lib/format'
import { formatContractYears, investorFigures } from './figures'

const SEASON_LABELS: Record<Season, string> = {
  typical: 'a typical day',
  worst: 'a rainy-season day',
}

// "30 October 2026". The locale is fixed so the date reads the same on every machine.
const formatToday = () =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const formatLitres = (litres: number) => `${Math.round(litres)} L`
const formatKg = (kg: number) => `${Math.round(kg)} kg`

// The same four-pane lit window as the nav mark. print.css colours it for paper.
function Mark() {
  return (
    <svg className="proposal__mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  )
}

interface ResultRowProps {
  label: string
  today: string
  withLifeline: string
}

function ResultRow({ label, today, withLifeline }: ResultRowProps) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{today}</td>
      <td>{withLifeline}</td>
    </tr>
  )
}

function Figure({ label, children }: { label: string; children: string }) {
  return (
    <div className="proposal__figure">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

interface ProposalProps {
  profile: HospitalProfile
  season: Season
  costs: CostAssumptions
  comparison: Comparison
  finance: FinanceResult
}

// The one-page summary the browser prints (DESIGN §11). It is hidden on screen and print.css
// shows it, and only it, when the page is printed.
export function Proposal({ profile, season, costs, comparison, finance }: ProposalProps) {
  const resultTitleId = useId()
  const { size } = comparison
  const today: TwinMetrics = comparison.baseline.metrics
  const withLifeline: TwinMetrics = comparison.lifeline.metrics
  const investor = investorFigures(finance, costs)
  const methodUrl = `${window.location.origin}${window.location.pathname}#/method`

  return (
    <article className="proposal" aria-label="Proposal">
      <header className="proposal__header">
        <div className="proposal__top">
          <p className="proposal__brand">
            <Mark />
            Lifeline
          </p>
          <p className="proposal__date">{formatToday()}</p>
        </div>
        <h2 className="proposal__title">Power continuity proposal for {profile.name}</h2>
      </header>

      <dl className="proposal__system">
        <div className="proposal__system-item">
          <dt>Solar</dt>
          <dd>{size.pvKwp.toLocaleString('en-US')} kWp</dd>
        </div>
        <div className="proposal__system-item">
          <dt>Battery</dt>
          <dd>{size.batteryKwh.toLocaleString('en-US')} kWh</dd>
        </div>
        <div className="proposal__system-item">
          <dt>Inverter</dt>
          <dd>{size.inverterKw.toLocaleString('en-US')} kW</dd>
        </div>
      </dl>

      <section className="proposal__block">
        <h3 id={resultTitleId}>Outage day result</h3>
        <p className="proposal__note">
          One simulated day, {SEASON_LABELS[season]}, with the same grid outages in both columns.
        </p>
        <table className="proposal__table" aria-labelledby={resultTitleId}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Measure</span>
              </th>
              <th scope="col">Today: diesel only</th>
              <th scope="col">With Lifeline</th>
            </tr>
          </thead>
          <tbody>
            <ResultRow
              label="Life-critical without power"
              today={formatDuration(today.t1MinutesUnpowered)}
              withLifeline={formatDuration(withLifeline.t1MinutesUnpowered)}
            />
            <ResultRow
              label="Diesel burned"
              today={formatLitres(today.dieselLitres)}
              withLifeline={formatLitres(withLifeline.dieselLitres)}
            />
            <ResultRow
              label="Energy cost"
              today={formatNgn(today.energyCostNgn)}
              withLifeline={formatNgn(withLifeline.energyCostNgn)}
            />
            <ResultRow label="CO₂" today={formatKg(today.co2Kg)} withLifeline={formatKg(withLifeline.co2Kg)} />
          </tbody>
        </table>
      </section>

      <section className="proposal__block">
        <h3>The offer</h3>
        <dl className="proposal__figures proposal__figures--four">
          <Figure label="Monthly fee">{formatNgn(finance.monthlyFeeNgn)}</Figure>
          <Figure label="Today's monthly spend">{formatNgn(finance.baselineAnnualNgn / 12)}</Figure>
          <Figure label="Savings per year">{formatNgn(finance.hospitalSavingsAnnualNgn)}</Figure>
          <Figure label="Contract length">{formatContractYears(costs.contractYears)}</Figure>
        </dl>
      </section>

      <section className="proposal__block">
        <h3>For the investor</h3>
        <dl className="proposal__figures">
          <Figure label="Upfront cost">
            {investor.upfrontUsd ? `${investor.upfront} (${investor.upfrontUsd})` : investor.upfront}
          </Figure>
          <Figure label="Payback">{investor.payback}</Figure>
          <Figure label={investor.returnLabel}>{investor.returnValue}</Figure>
        </dl>
      </section>

      <section className="proposal__block">
        <h3>How we got these numbers</h3>
        <ul className="proposal__method">
          <li>Loads come from the equipment list: rated power, share of time in use and quantity, hour by hour.</li>
          <li>
            The battery covers the night part of the longest outage, the panels are sized for the cloudiest month,
            and life-critical loads are never shed.
          </li>
          <li>
            Costs follow the assumptions in the Lifeline plan: diesel and grid prices, equipment prices, operating
            costs and the monthly fee.
          </li>
        </ul>
        <p className="proposal__method-link">Full method and sources: {methodUrl}</p>
      </section>

      <footer className="proposal__footer">
        Generated by Lifeline. Figures are estimates for planning and need a site audit before contract.
      </footer>
    </article>
  )
}
