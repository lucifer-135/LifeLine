import { useId } from 'react'
import type { CSSProperties } from 'react'
import './Slider.css'

// CSS custom properties are not in CSSProperties; this adds the one we set.
type SliderStyle = CSSProperties & Record<'--slider-fraction', number>

interface SliderProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

// Where the thumb sits along the track, 0 to 1. Slider.css fills the track up to it.
function fraction(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

export function Slider({ label, min, max, step, value, onChange, format = String }: SliderProps) {
  const id = useId()
  const shown = format(value)
  const style: SliderStyle = { '--slider-fraction': fraction(value, min, max) }

  return (
    <div className="slider">
      <label htmlFor={id} className="slider__label">
        {label}
      </label>
      <div className="slider__control">
        <input
          id={id}
          className="slider__input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          style={style}
          aria-valuetext={shown}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {/* aria-valuetext already speaks the value; announcing this too would double it. */}
        <span className="slider__value" aria-hidden="true">
          {shown}
        </span>
      </div>
    </div>
  )
}
