import { ChevronDown, TriangleAlert } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState, useSyncExternalStore } from 'react'
import { formatEvent, stepToClock } from '../../engine/events'
import type { TwinEvent, TwinEventKind } from '../../engine/types'
import './EventLog.css'

const MAX_SHOWN = 40

// Losing life-critical power is the alarm; anything coming back on is lamp light.
const ALARM_KINDS: ReadonlySet<TwinEventKind> = new Set(['t1_unpowered', 'fuel_out'])
const RESTORE_KINDS: ReadonlySet<TwinEventKind> = new Set([
  'grid_restored',
  'restore_t2',
  'restore_t3',
  't1_restored',
])

// --dur-base with --ease-out.
const ENTER = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const

// Below 768px the log folds away behind its button (EventLog.css, same breakpoint).
const FOLDED_QUERY = '(max-width: 767px)'

function subscribeToFolded(onChange: () => void): () => void {
  const query = window.matchMedia(FOLDED_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function isFolded(): boolean {
  return window.matchMedia(FOLDED_QUERY).matches
}

// What the phone announcer reads: the time, then every event of the latest step with
// events, oldest first (losing the grid and pausing loads can happen in the same step).
function announcementFor(happened: TwinEvent[]): string {
  const latest = happened.at(-1)
  if (!latest) return ''
  const messages = happened.filter((event) => event.step === latest.step).map(formatEvent)
  return `${stepToClock(latest.step)} ${messages.join(' ')}`
}

function entryClass(kind: TwinEventKind): string {
  if (ALARM_KINDS.has(kind)) return 'event-log__entry event-log__entry--alarm'
  if (RESTORE_KINDS.has(kind)) return 'event-log__entry event-log__entry--restore'
  return 'event-log__entry'
}

interface EventLogProps {
  events: TwinEvent[]
  step: number
}

// The day's events so far, newest first. This is the page's only live region. On a phone
// it folds away behind its heading, so the chart is not pushed far down the page.
export function EventLog({ events, step }: EventLogProps) {
  const reduceMotion = useReducedMotion() === true
  const folded = useSyncExternalStore(subscribeToFolded, isFolded)
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const bodyId = useId()

  // Events come in step order from the engine.
  const happened = events.filter((event) => event.step <= step)
  const shown = happened.slice(-MAX_SHOWN).reverse()

  return (
    <section className="event-log" data-open={open} aria-labelledby={titleId}>
      <h2 id={titleId} className="event-log__title">
        Event log
      </h2>
      <h2 className="event-log__toggle-heading">
        <button
          type="button"
          className="event-log__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          Event log ({happened.length})
          <ChevronDown className="event-log__chevron" size={20} />
        </button>
      </h2>
      {/* A folded log is hidden from assistive tech, so it cannot announce. This region
          sits outside the fold and speaks for it; the list then stays quiet, so an opened
          log is not read twice. */}
      {folded ? (
        <p className="visually-hidden" role="status" aria-live="polite">
          {announcementFor(happened)}
        </p>
      ) : null}
      <div id={bodyId} className="event-log__body">
        <ol className="event-log__list" aria-live={folded ? undefined : 'polite'}>
          {shown.map((event) => (
            <motion.li
              key={`${event.step}-${event.kind}`}
              className={entryClass(event.kind)}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={ENTER}
            >
              <time className="event-log__time" dateTime={stepToClock(event.step)}>
                {stepToClock(event.step)}
              </time>
              <span className="event-log__message">
                {ALARM_KINDS.has(event.kind) && <TriangleAlert className="event-log__icon" size={16} />}
                {formatEvent(event)}
              </span>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
