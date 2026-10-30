import type { CostAssumptions, FinanceResult } from '../../engine/types'
import { formatNgn, formatPct, formatUsd, formatYears } from '../../lib/format'

// The investor figures are read on the page and on the printed proposal, so the
// wording is built once here and both show the same text.

export function formatContractYears(years: number): string {
  return `${years} ${years === 1 ? 'year' : 'years'}`
}

// IRR is null when the provider has no positive return to measure.
function formatReturn(irr: number | null): string {
  return irr === null || !Number.isFinite(irr) ? 'n/a' : `${formatPct(irr)} a year`
}

// Whole tonnes. Adding 0 turns a rounded -0 into 0, which would otherwise print as "-0".
function formatTonnesPerYear(tonnes: number): string {
  if (!Number.isFinite(tonnes)) return 'n/a'
  return `${(Math.round(tonnes) + 0).toLocaleString('en-US')} t a year`
}

export interface InvestorFigures {
  upfront: string
  // Shown beside the naira amount; null when the exchange rate cannot convert it.
  upfrontUsd: string | null
  payback: string
  returnLabel: string
  returnValue: string
  co2Avoided: string
}

export function investorFigures(finance: FinanceResult, costs: CostAssumptions): InvestorFigures {
  const usd = formatUsd(finance.capexNgn, costs.ngnPerUsd)
  return {
    upfront: formatNgn(finance.capexNgn),
    upfrontUsd: usd === 'n/a' ? null : usd,
    payback: formatYears(finance.paybackYears),
    returnLabel: `Return over ${formatContractYears(costs.contractYears)}`,
    returnValue: formatReturn(finance.irr),
    co2Avoided: formatTonnesPerYear(finance.co2AvoidedTonnesYear),
  }
}
