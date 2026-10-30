import { BatteryMedium, Sun, Zap } from 'lucide-react'
import type { SystemSize } from '../../engine/types'
import './SizeCards.css'

// The solar data stores the worst month as a three-letter code.
const MONTH_NAMES: Record<string, string> = {
  JAN: 'January',
  FEB: 'February',
  MAR: 'March',
  APR: 'April',
  MAY: 'May',
  JUN: 'June',
  JUL: 'July',
  AUG: 'August',
  SEP: 'September',
  OCT: 'October',
  NOV: 'November',
  DEC: 'December',
}

const formatAmount = (n: number) => n.toLocaleString('en-US')

interface SizeCardsProps {
  size: SystemSize
  stateName: string
  // Three-letter code, for example "AUG".
  worstMonth: string
}

// Datasheet rows, not cards: icon and label, the size as the big number, one plain sentence.
export function SizeCards({ size, stateName, worstMonth }: SizeCardsProps) {
  const month = MONTH_NAMES[worstMonth] ?? worstMonth
  const pv = formatAmount(size.pvKwp)
  const battery = formatAmount(size.batteryKwh)
  const inverter = formatAmount(size.inverterKw)

  return (
    <dl className="size-rows">
      <div className="size-row">
        <dt className="size-row__label">
          <Sun size={20} />
          Solar
        </dt>
        <dd className="size-row__value live-number">{pv} kWp</dd>
        <dd className="size-row__sentence">
          {pv} kWp of panels, sized for {month} — the cloudiest month in {stateName}.
        </dd>
      </div>
      <div className="size-row">
        <dt className="size-row__label">
          <BatteryMedium size={20} />
          Battery
        </dt>
        <dd className="size-row__value live-number">{battery} kWh</dd>
        <dd className="size-row__sentence">
          {battery} kWh of lithium (LFP) storage, enough to carry life-critical and essential loads through the night.
        </dd>
      </div>
      <div className="size-row">
        <dt className="size-row__label">
          <Zap size={20} />
          Inverter
        </dt>
        <dd className="size-row__value live-number">{inverter} kW</dd>
        <dd className="size-row__sentence">
          {inverter} kW, with 25% headroom over the peak of life-critical and essential loads.
        </dd>
      </div>
    </dl>
  )
}
