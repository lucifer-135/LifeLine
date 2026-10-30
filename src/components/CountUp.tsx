import { animate, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import './CountUp.css'

// Matches --dur-count and --ease-out. Motion takes seconds and a number array,
// so the CSS tokens cannot be read here.
const DEFAULT_DURATION_MS = 900
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

interface CountUpProps {
  value: number
  format: (n: number) => string
  durationMs?: number
  // Wait until the element scrolls into view (once), then count up.
  startOnView?: boolean
}

// Counts from the number currently on screen to `value`, starting from 0 on
// first mount. With reduced motion it shows `value` at once.
export function CountUp({ value, format, durationMs = DEFAULT_DURATION_MS, startOnView = false }: CountUpProps) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const motionValue = useMotionValue(0)
  const [current, setCurrent] = useState(0)
  useMotionValueEvent(motionValue, 'change', setCurrent)

  const waitingForView = startOnView && !inView
  useEffect(() => {
    if (reduceMotion || waitingForView) return
    // Retargeting mid-count starts from wherever the number is now, and the
    // cleanup stops the old animation so none outlives its value or the component.
    const controls = animate(motionValue, value, { duration: durationMs / 1000, ease: EASE_OUT })
    return () => controls.stop()
  }, [motionValue, value, durationMs, reduceMotion, waitingForView])

  return (
    <span ref={ref} className="count-up">
      {/* The visible digits change every frame, so screen readers get the final value only. */}
      <span aria-hidden="true">{format(reduceMotion ? value : current)}</span>
      <span className="visually-hidden">{format(value)}</span>
    </span>
  )
}
