import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'
import { Card } from '../../components/Card'
import { CountUp } from '../../components/CountUp'
import { Slider } from '../../components/Slider'
import type { CostAssumptions, FinanceResult } from '../../engine/types'
import { formatNgn } from '../../lib/format'
import { investorFigures } from './figures'
import './FinancePanel.css'

// --dur-base and --ease-out. Motion takes seconds and a number array, so the CSS tokens
// cannot be read here.
const BAR_TRANSITION = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const

// The fee slider's range, in percent.
const FEE_MIN_PERCENT = 70
const FEE_MAX_PERCENT = 85

// How much of the track a bar fills: 0 to 1, with the longer of the two amounts as 1.
function share(amount: number, longest: number): number {
  if (!Number.isFinite(amount) || !(longest > 0)) return 0
  return Math.min(1, Math.max(0, amount / longest))
}

interface BarProps {
  scale: number
  origin: 'left' | 'right'
  kind: 'today' | 'fee' | 'gap'
}

// Width is never animated: the bar is full width and scaleX() shortens it.
function Bar({ scale, origin, kind }: BarProps) {
  const reduceMotion = useReducedMotion() === true
  return (
    <motion.div
      className={`money-bar__fill money-bar__fill--${kind}`}
      data-bar={kind}
      style={{ transformOrigin: origin }}
      initial={reduceMotion ? false : { scaleX: 0 }}
      animate={{ scaleX: scale }}
      transition={reduceMotion ? { duration: 0 } : BAR_TRANSITION}
    />
  )
}

// Today's monthly spend against the Lifeline fee, on one scale. The amounts are text, so the
// bars are decoration for sighted readers and hidden from assistive tech.
function MoneyBar({ finance }: { finance: FinanceResult }) {
  const captionId = useId()
  const todayMonthly = finance.baselineAnnualNgn / 12
  const fee = finance.monthlyFeeNgn
  const longest = Math.max(todayMonthly, fee)
  const gap = Math.max(0, todayMonthly - fee)

  return (
    <div className="money-bar">
      <p id={captionId} className="finance__caption">
        Monthly cost
      </p>
      <ul className="money-bar__rows" aria-labelledby={captionId}>
        <li className="money-bar__row">
          <span className="money-bar__label">Today</span>
          <span className="money-bar__value">{formatNgn(todayMonthly)}</span>
          <div className="money-bar__track" aria-hidden="true">
            <Bar kind="today" origin="left" scale={share(todayMonthly, longest)} />
          </div>
        </li>
        <li className="money-bar__row">
          <span className="money-bar__label">Lifeline fee</span>
          <span className="money-bar__value">{formatNgn(fee)}</span>
          <div className="money-bar__track" aria-hidden="true">
            <Bar kind="fee" origin="left" scale={share(fee, longest)} />
            {/* What the hospital keeps each month: the stretch from the fee to today's spend. */}
            <Bar kind="gap" origin="right" scale={share(gap, longest)} />
          </div>
        </li>
      </ul>
      <p className="money-bar__saving">Saves {formatNgn(gap)} a month</p>
    </div>
  )
}

interface FinancePanelProps {
  finance: FinanceResult
  costs: CostAssumptions
  onFeeChange: (feeFraction: number) => void
}

export function FinancePanel({ finance, costs, onFeeChange }: FinancePanelProps) {
  const investor = investorFigures(finance, costs)

  return (
    <Card className="finance">
      <p className="finance-hero">
        <span className="finance-hero__text">Hospital saves</span>{' '}
        <span className="finance-hero__number live-number">
          <CountUp value={finance.hospitalSavingsAnnualNgn} format={formatNgn} />
        </span>{' '}
        <span className="finance-hero__text">a year</span>
      </p>

      <MoneyBar finance={finance} />

      <Slider
        label="Monthly fee, as a share of today's spend"
        min={FEE_MIN_PERCENT}
        max={FEE_MAX_PERCENT}
        step={1}
        value={Math.round(costs.feeFraction * 100)}
        format={(percent) => `${percent}%`}
        onChange={(percent) => onFeeChange(percent / 100)}
      />

      <div className="finance-investor">
        <h3>For the investor</h3>
        <dl className="finance-investor__rows">
          <div className="finance-investor__item">
            <dt>Upfront cost</dt>
            <dd>
              <span className="finance-investor__figure">{investor.upfront}</span>
              {investor.upfrontUsd ? (
                <>
                  {' '}
                  <span className="finance-investor__secondary">{investor.upfrontUsd}</span>
                </>
              ) : null}
            </dd>
          </div>
          <div className="finance-investor__item">
            <dt>Payback</dt>
            <dd>
              <span className="finance-investor__figure">{investor.payback}</span>
            </dd>
          </div>
          <div className="finance-investor__item">
            <dt>{investor.returnLabel}</dt>
            <dd>
              <span className="finance-investor__figure">{investor.returnValue}</span>
            </dd>
          </div>
          <div className="finance-investor__item">
            <dt>CO₂ avoided</dt>
            <dd>
              <span className="finance-investor__figure">{investor.co2Avoided}</span>
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}
