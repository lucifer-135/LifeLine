import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { TwinStep } from '../../engine/types'
import { RunwayGauge } from './RunwayGauge'

function twinStep(over: Partial<TwinStep> = {}): TwinStep {
  return {
    t: 8,
    gridUp: false,
    loadKw: { T1: 4, T2: 2, T3: 1 },
    servedKw: { T1: 4, T2: 2, T3: 1 },
    shedT2: false,
    shedT3: false,
    pvKw: 0,
    pvUsedKw: 0,
    curtailedKw: 0,
    gridKw: 0,
    chargeKw: 0,
    dischargeKw: 0,
    dieselKw: 0,
    soc: 0.5,
    fuelLitresLeft: 20,
    t1RunwayMin: 300,
    ...over,
  }
}

function runway(): HTMLElement {
  return screen.getByRole('region', { name: 'ICU runway' })
}

describe('RunwayGauge', () => {
  test('shows the cover left while the grid is down', () => {
    render(<RunwayGauge twinStep={twinStep()} hasBattery />)
    expect(runway()).toHaveTextContent('ICU covered for')
    expect(runway()).toHaveTextContent('5h 0m')
    expect(runway()).toHaveTextContent('Battery 50%')
    expect(runway()).not.toHaveAttribute('data-level')
  })

  test('warns under 2 hours of cover', () => {
    render(<RunwayGauge twinStep={twinStep({ t1RunwayMin: 119 })} hasBattery={false} />)
    expect(runway()).toHaveAttribute('data-level', 'warn')
    expect(runway()).toHaveTextContent('1h 59m')
    expect(runway()).toHaveTextContent('No battery')
  })

  // With no life-critical load the engine divides by a tiny floor, so the raw runway
  // would print as billions of hours.
  test('says there is no life-critical load instead of an absurd runway', () => {
    const idle = twinStep({ loadKw: { T1: 0, T2: 2, T3: 1 }, servedKw: { T1: 0, T2: 2, T3: 1 }, t1RunwayMin: 6e11 })
    render(<RunwayGauge twinStep={idle} hasBattery />)
    expect(runway()).toHaveTextContent('No life-critical load now')
    expect(runway()).not.toHaveTextContent('ICU covered for')
    expect(runway()).not.toHaveTextContent(/\d{3,}h/)
    expect(runway()).not.toHaveAttribute('data-level')
  })

  test('caps the runway above 99 hours', () => {
    const { unmount } = render(<RunwayGauge twinStep={twinStep({ t1RunwayMin: 99 * 60 + 1 })} hasBattery />)
    expect(runway()).toHaveTextContent('over 99h')
    unmount()

    render(<RunwayGauge twinStep={twinStep({ t1RunwayMin: 99 * 60 })} hasBattery />)
    expect(runway()).toHaveTextContent('99h 0m')
  })
})
