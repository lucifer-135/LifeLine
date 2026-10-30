import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { SOURCES } from '../data/sources'
import type { Tier } from '../engine/types'
import { Card } from './Card'
import { CountUp } from './CountUp'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'
import { Slider } from './Slider'
import { SourceRef } from './SourceRef'
import { TierBadge } from './TierBadge'

// motion reads the reduced-motion query once, on the first useReducedMotion()
// call, then only updates when the query fires 'change'. So the query is
// installed at file scope, before any render, and tests flip it through
// setReducedMotion() instead of re-mocking matchMedia per test.
let reduceMotion = false
const changeListeners = new Set<EventListenerOrEventListenerObject>()

vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
  get matches() {
    return reduceMotion && query.includes('prefers-reduced-motion')
  },
  media: query,
  onchange: null,
  addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    changeListeners.add(listener)
  },
  removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    changeListeners.delete(listener)
  },
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

function setReducedMotion(reduce: boolean) {
  reduceMotion = reduce
  const event = new Event('change')
  for (const listener of changeListeners) {
    if (typeof listener === 'function') listener(event)
    else listener.handleEvent(event)
  }
}

afterEach(() => setReducedMotion(false))

// The animating text is aria-hidden; a visually hidden twin holds the final value.
// Exact text, not toHaveTextContent: that matches substrings, and '0 kW' is one of '1,200 kW'.
function animatingText(container: HTMLElement): string | null {
  const element = container.querySelector<HTMLElement>('[aria-hidden="true"]')
  if (!element) throw new Error('CountUp has no aria-hidden text')
  return element.textContent
}

const formatKw = (n: number) => `${Math.round(n).toLocaleString('en-US')} kW`

describe('CountUp', () => {
  test('renders the final value at once with reduced motion', () => {
    setReducedMotion(true)
    const { container } = render(<CountUp value={1200} format={formatKw} />)
    expect(animatingText(container)).toBe('1,200 kW')
  })

  test('counts up from zero to the value', async () => {
    const { container } = render(<CountUp value={1200} format={formatKw} durationMs={60} />)
    expect(animatingText(container)).toBe('0 kW')
    await waitFor(() => expect(animatingText(container)).toBe('1,200 kW'))
  })

  test('gives assistive tech the final value before the animation ends', () => {
    render(<CountUp value={1200} format={formatKw} durationMs={60} />)
    expect(screen.getByText('1,200 kW', { selector: '.visually-hidden' })).toBeInTheDocument()
  })

  test('animates to a new value when the value changes', async () => {
    const { container, rerender } = render(<CountUp value={100} format={formatKw} durationMs={60} />)
    await waitFor(() => expect(animatingText(container)).toBe('100 kW'))
    rerender(<CountUp value={400} format={formatKw} durationMs={60} />)
    expect(screen.getByText('400 kW', { selector: '.visually-hidden' })).toBeInTheDocument()
    await waitFor(() => expect(animatingText(container)).toBe('400 kW'))
  })

  test('startOnView waits at zero until the element is in view', async () => {
    // The IntersectionObserver stub never fires, so the element is never "in view".
    const { container } = render(<CountUp value={1200} format={formatKw} durationMs={30} startOnView />)
    // act() so any animation frames and state updates in the window are flushed.
    await act(() => new Promise((resolve) => setTimeout(resolve, 120)))
    expect(animatingText(container)).toBe('0 kW')
  })

  test('startOnView with reduced motion still shows the final value', () => {
    setReducedMotion(true)
    const { container } = render(<CountUp value={1200} format={formatKw} startOnView />)
    expect(animatingText(container)).toBe('1,200 kW')
  })
})

describe('Slider', () => {
  test('is labelled and reports changes as numbers', () => {
    const onChange = vi.fn()
    render(<Slider label="Monthly fee" min={70} max={85} step={1} value={75} onChange={onChange} />)
    const slider = screen.getByLabelText('Monthly fee')
    expect(slider).toHaveAttribute('type', 'range')
    fireEvent.change(slider, { target: { value: '80' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(80)
  })

  test('shows the formatted value and exposes it as aria-valuetext', () => {
    render(
      <Slider label="Monthly fee" min={70} max={85} step={1} value={75} onChange={() => {}} format={(v) => `${v}%`} />,
    )
    expect(screen.getByLabelText('Monthly fee')).toHaveAttribute('aria-valuetext', '75%')
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  test('shows the raw value when no format is given', () => {
    render(<Slider label="Hours" min={0} max={24} step={1} value={12} onChange={() => {}} />)
    expect(screen.getByLabelText('Hours')).toHaveAttribute('aria-valuetext', '12')
  })
})

describe('NumberField', () => {
  test('shows an error linked to the field when the value is out of range', () => {
    render(<NumberField label="Beds" value={30} min={0} max={24} onChange={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Enter a value from 0 to 24.')
    const field = screen.getByLabelText('Beds')
    expect(field).toHaveAccessibleDescription(/Enter a value from 0 to 24\./)
    expect(field).toBeInvalid()
  })

  test('shows no error for an in-range value', () => {
    render(<NumberField label="Beds" value={12} min={0} max={24} onChange={() => {}} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('words the error for a single bound', () => {
    const { rerender } = render(<NumberField label="Beds" value={-1} min={0} onChange={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value of 0 or more.')
    rerender(<NumberField label="Beds" value={25} max={24} onChange={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value of 24 or less.')
  })

  test('reports typed numbers, but never NaN when the field is cleared', () => {
    const onChange = vi.fn()
    render(<NumberField label="Beds" value={5} onChange={onChange} />)
    const field = screen.getByLabelText('Beds')
    fireEvent.change(field, { target: { value: '' } })
    expect(field).toHaveValue(null)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(7)
  })

  test('asks for a value when blurred empty, and clears the error once one is typed', () => {
    render(<NumberField label="Beds" value={5} min={0} max={24} onChange={() => {}} />)
    const field = screen.getByLabelText('Beds')
    fireEvent.change(field, { target: { value: '' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.blur(field)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a value from 0 to 24.')
    fireEvent.change(field, { target: { value: '8' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('asks for a number when blurred empty and there are no bounds', () => {
    render(<NumberField label="Beds" value={5} onChange={() => {}} />)
    const field = screen.getByLabelText('Beds')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a number.')
  })

  test('follows the value when the parent changes it', () => {
    const { rerender } = render(<NumberField label="Beds" value={5} onChange={() => {}} />)
    rerender(<NumberField label="Beds" value={9} onChange={() => {}} />)
    expect(screen.getByLabelText('Beds')).toHaveValue(9)
  })

  test('keeps the label for assistive tech when it is visually hidden', () => {
    render(<NumberField label="ICU ventilator quantity" hideLabel compact value={2} onChange={() => {}} suffix="units" />)
    expect(screen.getByLabelText('ICU ventilator quantity')).toHaveValue(2)
    expect(screen.getByText('units')).toBeInTheDocument()
  })
})

describe('SegmentedControl', () => {
  const SPEEDS = [
    { value: 1, label: '1×' },
    { value: 4, label: '4×' },
    { value: 16, label: '16×' },
  ]

  function Speeds({ onChange }: { onChange: (v: number) => void }) {
    const [speed, setSpeed] = useState(4)
    return (
      <SegmentedControl
        label="Speed"
        options={SPEEDS}
        value={speed}
        onChange={(v) => {
          setSpeed(v)
          onChange(v)
        }}
      />
    )
  }

  const radio = (name: string) => screen.getByRole('radio', { name })

  test('is a labelled radiogroup with only the selected option tabbable', () => {
    render(<Speeds onChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Speed' })).toBeInTheDocument()
    expect(radio('4×')).toHaveAttribute('aria-checked', 'true')
    expect(radio('1×')).toHaveAttribute('aria-checked', 'false')
    expect(radio('4×')).toHaveAttribute('tabindex', '0')
    expect(radio('1×')).toHaveAttribute('tabindex', '-1')
    expect(radio('16×')).toHaveAttribute('tabindex', '-1')
  })

  test('a click selects an option', () => {
    const onChange = vi.fn()
    render(<Speeds onChange={onChange} />)
    fireEvent.click(radio('16×'))
    expect(onChange).toHaveBeenCalledWith(16)
    expect(radio('16×')).toHaveAttribute('aria-checked', 'true')
  })

  test('arrow keys move the selection and the focus, and wrap at the ends', () => {
    const onChange = vi.fn()
    render(<Speeds onChange={onChange} />)
    radio('4×').focus()

    fireEvent.keyDown(radio('4×'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(16)
    expect(radio('16×')).toHaveAttribute('aria-checked', 'true')
    expect(radio('16×')).toHaveFocus()

    fireEvent.keyDown(radio('16×'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(radio('1×')).toHaveAttribute('aria-checked', 'true')
    expect(radio('1×')).toHaveFocus()

    fireEvent.keyDown(radio('1×'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(16)
    expect(radio('16×')).toHaveAttribute('aria-checked', 'true')

    fireEvent.keyDown(radio('16×'), { key: 'ArrowUp' })
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(radio('4×'), { key: 'ArrowDown' })
    expect(onChange).toHaveBeenLastCalledWith(16)
  })

  test('Home and End jump to the first and last option', () => {
    const onChange = vi.fn()
    render(<Speeds onChange={onChange} />)
    fireEvent.keyDown(radio('4×'), { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith(16)
    fireEvent.keyDown(radio('16×'), { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith(1)
    expect(radio('1×')).toHaveAttribute('aria-checked', 'true')
  })

  test('other keys do nothing', () => {
    const onChange = vi.fn()
    render(<Speeds onChange={onChange} />)
    fireEvent.keyDown(radio('4×'), { key: 'a' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SourceRef', () => {
  test('links to the Method entry with the source number and label', () => {
    const id = 'cost.dieselNgnPerLitre'
    const index = SOURCES.findIndex((source) => source.id === id)
    const source = SOURCES[index]
    expect(source).toBeDefined()

    render(<SourceRef id={id} />)
    const link = screen.getByRole('link', { name: `Source: ${source.label}` })
    expect(link).toHaveAttribute('href', `#/method#src-${id}`)
    expect(link).toHaveTextContent(String(index + 1))
    expect(link.parentElement?.tagName).toBe('SUP')
  })

  test('throws for an unknown source id, so typos fail loudly', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<SourceRef id="cost.doesNotExist" />)).toThrow('cost.doesNotExist')
    } finally {
      consoleError.mockRestore()
    }
  })
})

describe('TierBadge', () => {
  test.each<[Tier, string]>([
    ['T1', 'Life-critical'],
    ['T2', 'Essential'],
    ['T3', 'Can wait'],
  ])('%s shows "%s" and never the tier code', (tier, text) => {
    const { container } = render(<TierBadge tier={tier} />)
    expect(container).toHaveTextContent(text)
    expect(container).not.toHaveTextContent(tier)
  })
})

describe('Card', () => {
  test('renders a section that can be named by its heading', () => {
    render(
      <Card as="section" aria-labelledby="card-title">
        <h2 id="card-title">Verdict</h2>
      </Card>,
    )
    expect(screen.getByRole('region', { name: 'Verdict' })).toBeInTheDocument()
  })

  test('renders a plain div by default and passes className through', () => {
    const { container } = render(
      <Card variant="inset" className="extra">
        Body
      </Card>,
    )
    const card = container.firstElementChild
    expect(card?.tagName).toBe('DIV')
    expect(card).toHaveClass('extra')
    expect(card).toHaveTextContent('Body')
  })
})
