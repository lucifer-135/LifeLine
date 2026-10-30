import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import './SegmentedControl.css'

interface SegmentedControlProps<T extends string | number> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

// Where an arrow or Home/End key sends the selection; null for other keys.
// Arrows wrap, like the native radio group this stands in for.
function targetIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = options.findIndex((option) => option.value === value)
  // Roving tabindex: one tab stop for the group. If nothing matches the value,
  // the first option keeps the group reachable.
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex

  function select(index: number) {
    onChange(options[index].value)
    buttons.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const next = targetIndex(event.key, index, options.length)
    if (next === null) return
    event.preventDefault()
    select(next)
  }

  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            buttons.current[index] = element
          }}
          type="button"
          role="radio"
          aria-checked={index === selectedIndex}
          tabIndex={index === tabStop ? 0 : -1}
          className="segmented__option"
          onClick={() => select(index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
