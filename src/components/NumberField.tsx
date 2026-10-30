import { useId, useState } from 'react'
import './NumberField.css'

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  // 36px tall, for inline use inside tables only.
  compact?: boolean
  // Keep the label for assistive tech but not on screen, e.g. in a table cell
  // whose column header already names the field.
  hideLabel?: boolean
}

// null for an empty or unparseable draft. Only finite numbers reach onChange.
function parseDraft(draft: string): number | null {
  if (draft.trim() === '') return null
  const parsed = Number(draft)
  return Number.isFinite(parsed) ? parsed : null
}

function rangeMessage(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `Enter a value from ${min} to ${max}.`
  if (min !== undefined) return `Enter a value of ${min} or more.`
  if (max !== undefined) return `Enter a value of ${max} or less.`
  return 'Enter a number.'
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  compact = false,
  hideLabel = false,
}: NumberFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const suffixId = `${id}-suffix`

  // The user edits text, not a number: clearing the box to retype must not push
  // NaN (or a surprise 0) up to the parent. The draft follows `value` only when
  // the parent changes it to something the draft does not already say.
  const [draft, setDraft] = useState(String(value))
  const [previousValue, setPreviousValue] = useState(value)
  const [blurred, setBlurred] = useState(false)
  if (value !== previousValue) {
    setPreviousValue(value)
    if (parseDraft(draft) !== value) setDraft(String(value))
  }

  const parsed = parseDraft(draft)
  const outOfRange = parsed !== null && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max))
  // An out-of-range number is wrong as soon as it shows. An empty box is not
  // wrong while the user is still typing, only once they leave it.
  const hasError = outOfRange || (parsed === null && blurred)

  const describedBy = [suffix ? suffixId : null, hasError ? errorId : null].filter(Boolean).join(' ')

  function handleChange(text: string) {
    setDraft(text)
    setBlurred(false)
    const next = parseDraft(text)
    if (next !== null) onChange(next)
  }

  return (
    <div className={`number-field${compact ? ' number-field--compact' : ''}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'number-field__label'}>
        {label}
      </label>
      <div className="number-field__control">
        <input
          id={id}
          className="number-field__input"
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step ?? 'any'}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setBlurred(true)}
        />
        {suffix ? (
          <span id={suffixId} className="number-field__suffix">
            {suffix}
          </span>
        ) : null}
      </div>
      {hasError ? (
        <p id={errorId} className="number-field__error" role="alert">
          {rangeMessage(min, max)}
        </p>
      ) : null}
    </div>
  )
}
