import { TriangleAlert, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import { TierBadge } from '../../components/TierBadge'
import type { Equipment, HospitalProfile, TwinResult, TwinStep } from '../../engine/types'
import { NARROW_LAYOUT, WARD_ROOMS, WIDE_LAYOUT, wallPath } from './mapLayout'
import type { MapLayout, PlanRoom, WardRoom, WardRoomId } from './mapLayout'
import { ITEM_STATUS_TEXT, itemKw, itemStatus, roomServedKw } from './roomDetails'
import { itemsIn, roomState } from './roomState'
import type { RoomState } from './roomState'
import './HospitalMap.css'

// Below this map width the wide plan's 14-unit labels would render under 12 px,
// so the map switches to the two-column plan.
const WIDE_MIN_PX = 552

// How each state is spoken (room button) and written on the plan.
const STATE_WORDS: Record<RoomState, string> = {
  lit: 'lit',
  dim: 'partly paused',
  dark: 'paused',
  alarm: 'no power',
}
const STATE_LABELS: Record<RoomState, string | null> = {
  lit: null,
  dim: 'Partly paused',
  dark: 'Paused',
  alarm: 'No power',
}

// Opacity of the lamp light. The light itself is --lamp at 22% (HospitalMap.css), so a dim
// room shows 8%, as DESIGN §6.2 asks.
const LIGHT: Record<RoomState, number> = { lit: 1, dim: 8 / 22, dark: 0, alarm: 0 }
const ROOM_SPRING = { type: 'spring', stiffness: 260, damping: 30 } as const
const INSTANT = { duration: 0 } as const
// --dur-fast with --ease-out, for the popover fade.
const POPOVER_FADE = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } as const

const BATTERY_SEGMENTS = 5
const PUFF_COUNT = 3

// CSS custom properties are not in CSSProperties; these are the two the popover reads.
type PopoverStyle = CSSProperties & Record<'--pop-x' | '--pop-y', string>

// Picks the plan for the width the map actually has. ResizeObserver keeps it right when
// the window or the page layout changes.
function useWideLayout(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = (width: number) => setWide(width >= WIDE_MIN_PX)
    update(element.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return wide
}

// A segment is lit for each fifth of charge, rounded, and one stays lit while any is left.
function litSegments(soc: number): number {
  if (soc <= 0) return 0
  return Math.max(1, Math.min(BATTERY_SEGMENTS, Math.round(soc * BATTERY_SEGMENTS)))
}

// Two windows in each ward's top wall, clear of the doors. Lit windows glow with the room.
const WINDOW_CENTRES = [0.25, 0.75]
const WINDOW_HALF = 9

function WindowTicks({ plan, className }: { plan: PlanRoom; className: string }) {
  return (
    <g className={className}>
      {WINDOW_CENTRES.map((centre) => {
        const middle = plan.x + plan.width * centre
        return <line key={centre} x1={middle - WINDOW_HALF} y1={plan.y} x2={middle + WINDOW_HALF} y2={plan.y} />
      })}
    </g>
  )
}

interface MapRoomProps {
  room: WardRoom
  plan: PlanRoom
  state: RoomState
  servedKw: number
  open: boolean
  onToggle: () => void
}

function MapRoom({ room, plan, state, servedKw, open, onToggle }: MapRoomProps) {
  const reduceMotion = useReducedMotion() === true
  const label = STATE_LABELS[state]
  const { x, y, width, height } = plan

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onToggle()
  }

  return (
    <g
      className={`map-room map-room--${state}`}
      data-room={room.id}
      role="button"
      tabIndex={0}
      aria-label={`${room.name}: ${STATE_WORDS[state]}, ${servedKw.toFixed(1)} kW served`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <rect className="map-room__floor" x={x} y={y} width={width} height={height} />
      <path className="map-room__walls" d={wallPath(plan, plan.door)} />
      <WindowTicks plan={plan} className="map-room__windows" />
      <motion.g
        className="map-room__light"
        initial={false}
        animate={{ opacity: LIGHT[state] }}
        transition={reduceMotion ? INSTANT : ROOM_SPRING}
      >
        <rect className="map-room__fill" x={x + 1} y={y + 1} width={width - 2} height={height - 2} />
        <WindowTicks plan={plan} className="map-room__windows map-room__windows--lit" />
      </motion.g>
      {state === 'alarm' && (
        <rect className="map-room__alarm alarm-pulse" x={x + 3} y={y + 3} width={width - 6} height={height - 6} />
      )}
      <rect className="map-room__focus" x={x + 6} y={y + 6} width={width - 12} height={height - 12} rx={4} />
      <text className="map-room__name" x={x + 14} y={y + 28}>
        {room.name}
      </text>
      {label && (
        <text className="map-room__status" x={x + 14} y={y + 48}>
          {label}
        </text>
      )}
      {state === 'alarm' && (
        <TriangleAlert className="map-room__alarm-icon" x={x + width - 34} y={y + 12} width={20} height={20} />
      )}
    </g>
  )
}

interface RoomPopoverProps {
  room: WardRoom
  plan: PlanRoom
  layout: MapLayout
  items: Equipment[]
  step: number
  twinStep: TwinStep
  onClose: () => void
}

function RoomPopover({ room, plan, layout, items, step, twinStep, onClose }: RoomPopoverProps) {
  const reduceMotion = useReducedMotion() === true
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus moves into the popover when it opens, so Escape and Tab start from here.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Placed under its room, as a fraction of the plan, so it follows the SVG's scaling.
  const style: PopoverStyle = {
    '--pop-x': String(plan.x / layout.width),
    '--pop-y': String((plan.y + plan.height) / layout.height),
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    onClose()
  }

  return (
    <motion.div
      role="dialog"
      aria-label={`${room.name} equipment`}
      className="room-popover"
      style={style}
      onKeyDown={handleKeyDown}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={POPOVER_FADE}
    >
      <div className="room-popover__head">
        <h3 className="room-popover__title">{room.name}</h3>
        <button ref={closeRef} type="button" className="room-popover__close" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <ul className="room-popover__items">
        {items.map((item) => {
          const status = itemStatus(item, step, twinStep)
          return (
            <li key={item.id} className="room-popover__item">
              <span className="room-popover__name">{item.name}</span>
              <TierBadge tier={item.tier} />
              <span className={`room-popover__status room-popover__status--${status}`}>
                {ITEM_STATUS_TEXT[status]}
              </span>
              <span className="room-popover__kw">{itemKw(item).toFixed(1)} kW</span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )
}

function RoofArray({ layout, solarShare, hasSolar }: { layout: MapLayout; solarShare: number; hasSolar: boolean }) {
  return (
    <g className={hasSolar ? 'map-roof' : 'map-roof map-roof--none'}>
      <text className="map-label" x={layout.roofLabel.x} y={layout.roofLabel.y}>
        {hasSolar ? 'Roof solar' : 'No solar'}
      </text>
      {layout.panels.map((panel) => (
        <rect
          key={panel.x}
          className="map-roof__panel"
          {...panel}
          rx={2}
          style={hasSolar ? { fillOpacity: solarShare } : undefined}
        />
      ))}
    </g>
  )
}

const METER_HALF = 7

// Flowing while the grid supplies power; broken and crossed out at the meter while it is down.
function GridCable({ layout, gridUp }: { layout: MapLayout; gridUp: boolean }) {
  const { y, meterX, buildingX } = layout.grid
  const meterLeft = meterX - METER_HALF
  const meterRight = meterX + METER_HALF
  const breakAt = meterLeft / 2

  return (
    <g className={gridUp ? 'map-grid map-grid--up' : 'map-grid map-grid--down'} aria-hidden="true">
      <text className="map-label" x={2} y={y - 12}>
        Grid
      </text>
      {gridUp ? (
        <path
          className="map-grid__cable power-flow"
          d={`M 0 ${y} H ${meterLeft} M ${meterRight} ${y} H ${buildingX}`}
        />
      ) : (
        <path
          className="map-grid__cable"
          d={`M 0 ${y} H ${breakAt - 3} M ${breakAt + 3} ${y + 3} H ${meterLeft} M ${meterRight} ${y} H ${buildingX}`}
        />
      )}
      <rect className="map-grid__meter" x={meterLeft} y={y - METER_HALF} width={METER_HALF * 2} height={METER_HALF * 2} rx={2} />
      {!gridUp && (
        <path
          className="map-grid__cross"
          d={`M ${meterLeft + 3} ${y - 4} L ${meterRight - 3} ${y + 4} M ${meterRight - 3} ${y - 4} L ${meterLeft + 3} ${y + 4}`}
        />
      )}
    </g>
  )
}

function BatteryRoom({ plan, soc, hasBattery }: { plan: PlanRoom; soc: number; hasBattery: boolean }) {
  const lit = hasBattery ? litSegments(soc) : 0
  const segment = { width: 22, height: 14, gap: 4 }
  const left = plan.x + 14
  const top = plan.y + 40

  return (
    <g className={hasBattery ? 'map-plant map-battery' : 'map-plant map-battery map-battery--none'}>
      <rect className="map-room__floor" x={plan.x} y={plan.y} width={plan.width} height={plan.height} />
      <path className="map-room__walls" d={wallPath(plan, plan.door)} />
      <text className="map-room__name" x={left} y={plan.y + 28}>
        {hasBattery ? `Battery ${Math.round(soc * 100)}%` : 'No battery'}
      </text>
      {Array.from({ length: BATTERY_SEGMENTS }, (_, i) => (
        <rect
          key={i}
          className={i < lit ? 'map-battery__cell map-battery__cell--on' : 'map-battery__cell'}
          x={left + i * (segment.width + segment.gap)}
          y={top}
          width={segment.width}
          height={segment.height}
          rx={2}
        />
      ))}
    </g>
  )
}

function GeneratorRoom({ plan, running }: { plan: PlanRoom; running: boolean }) {
  const machine = { x: plan.x + plan.width - 92, y: plan.y + plan.height - 50, width: 64, height: 30 }
  const stackX = machine.x + machine.width - 14

  return (
    <g className={running ? 'map-plant map-generator map-generator--running' : 'map-plant map-generator'}>
      <rect className="map-room__floor" x={plan.x} y={plan.y} width={plan.width} height={plan.height} />
      <path className="map-room__walls" d={wallPath(plan, plan.door)} />
      <text className="map-room__name" x={plan.x + 14} y={plan.y + 28}>
        Generator
      </text>
      <text className="map-room__status" x={plan.x + 14} y={plan.y + 48}>
        {running ? 'Running' : 'Off'}
      </text>
      <rect className="map-generator__machine" {...machine} rx={3} />
      <rect className="map-generator__stack" x={stackX} y={machine.y - 8} width={6} height={8} />
      {running && (
        <g className="map-generator__smoke" aria-hidden="true">
          {Array.from({ length: PUFF_COUNT }, (_, i) => (
            <circle key={i} className="map-generator__puff" cx={stackX + 3} cy={machine.y - 12} r={5} />
          ))}
        </g>
      )}
    </g>
  )
}

interface HospitalMapProps {
  profile: HospitalProfile
  result: TwinResult
  step: number
  pvKwp: number
}

// The living floor plan: each ward's light follows the scenario's power at this step.
export function HospitalMap({ profile, result, step, pvKwp }: HospitalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layout = useWideLayout(containerRef) ? WIDE_LAYOUT : NARROW_LAYOUT
  const [openRoom, setOpenRoom] = useState<WardRoomId | null>(null)

  const rooms = useMemo(
    () =>
      WARD_ROOMS.map((room) => ({ room, items: itemsIn(room.wards, profile) })).filter(
        ({ items }) => items.length > 0,
      ),
    [profile],
  )

  const twinStep = result.steps[step]
  const withLifeline = result.scenario === 'lifeline'
  const solarShare = pvKwp > 0 ? Math.min(1, Math.max(0, twinStep.pvKw / pvKwp)) : 0
  const open = rooms.find(({ room }) => room.id === openRoom)

  function toggleRoom(id: WardRoomId) {
    setOpenRoom((current) => (current === id ? null : id))
  }

  // Focus goes back to the room that opened the popover.
  function closePopover() {
    const room = containerRef.current?.querySelector(`[data-room="${openRoom}"]`)
    if (room instanceof SVGElement) room.focus()
    setOpenRoom(null)
  }

  return (
    <div ref={containerRef} className="hospital-map">
      <svg
        className="hospital-map__plan"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label="Hospital floor plan"
      >
        <RoofArray layout={layout} solarShare={solarShare} hasSolar={withLifeline} />
        <GridCable layout={layout} gridUp={twinStep.gridUp} />
        {rooms.map(({ room, items }) => (
          <MapRoom
            key={room.id}
            room={room}
            plan={layout.rooms[room.id]}
            state={roomState(room.wards, step, result, profile)}
            servedKw={roomServedKw(items, step, twinStep)}
            open={openRoom === room.id}
            onToggle={() => toggleRoom(room.id)}
          />
        ))}
        <BatteryRoom plan={layout.battery} soc={twinStep.soc} hasBattery={withLifeline} />
        <GeneratorRoom plan={layout.generator} running={twinStep.dieselKw > 0} />
      </svg>
      {open && (
        <RoomPopover
          room={open.room}
          plan={layout.rooms[open.room.id]}
          layout={layout}
          items={open.items}
          step={step}
          twinStep={twinStep}
          onClose={closePopover}
        />
      )}
    </div>
  )
}
