import { stagger, steps, useAnimate, useReducedMotion } from 'motion/react'
import type { AnimationSequence } from 'motion/react'
import { useEffect } from 'react'
import './HeroScene.css'

// The home hero: a city and a hospital at night. The grid fails, the city goes
// dark, and the hospital stays lit because its battery takes over.

// Scene geometry in viewBox units. The SVG uses preserveAspectRatio
// "xMidYMax slice", so the bottom edge and the horizontal centre always stay in
// view: the hospital sits at the centre (x 720) and narrow screens crop the city.
// The view starts just above the tallest block and the hospital sign: the hero
// above it is the same night sky, so empty sky here would only push the scene
// below the fold. HeroScene.css repeats the view size (1440 × 260) and the
// hospital's left wall to place the caption.
const VIEW_WIDTH = 1440
const VIEW_TOP = 84
const VIEW_BOTTOM = 344
const GROUND_Y = 296

const WINDOW_WIDTH = 12
const WINDOW_HEIGHT = 16
const WINDOW_PITCH = 26
const WINDOW_INSET = 10
const TOP_FLOOR_GAP = 14
const STREET_LEVEL_GAP = 24

// City blocks, left to right. The blackout sweeps their window columns in this
// order, 40 ms apart, so the column count sets the length of the sweep.
const BLOCK_SPECS = [
  { x: 10, columns: 3, height: 150 },
  { x: 116, columns: 3, height: 206 },
  { x: 222, columns: 2, height: 118 },
  { x: 302, columns: 3, height: 176 },
  { x: 408, columns: 2, height: 132 },
  { x: 488, columns: 3, height: 190 },
  { x: 870, columns: 3, height: 170 },
  { x: 976, columns: 2, height: 126 },
  { x: 1056, columns: 3, height: 204 },
  { x: 1162, columns: 3, height: 146 },
  { x: 1268, columns: 2, height: 186 },
  { x: 1348, columns: 3, height: 122 },
]

const CITY_BLOCKS = BLOCK_SPECS.map(({ x, columns, height }) => ({
  x,
  top: GROUND_Y - height,
  width: 2 * WINDOW_INSET + (columns - 1) * WINDOW_PITCH + WINDOW_WIDTH,
}))

function windowRows(blockTop: number): number[] {
  const rows: number[] = []
  for (let y = blockTop + TOP_FLOOR_GAP; y + WINDOW_HEIGHT <= GROUND_Y - STREET_LEVEL_GAP; y += WINDOW_PITCH) {
    rows.push(y)
  }
  return rows
}

// A few windows are already dark before the outage, as in a real city at night.
function isLitBeforeOutage(column: number, row: number): boolean {
  return (column * 5 + row * 3) % 7 !== 0
}

const CITY_COLUMNS = BLOCK_SPECS.flatMap(({ x, columns, height }) =>
  Array.from({ length: columns }, (_, i) => ({
    x: x + WINDOW_INSET + i * WINDOW_PITCH,
    rows: windowRows(GROUND_Y - height),
  })),
).map((column, index) => ({
  ...column,
  litRows: column.rows.filter((_, row) => isLitBeforeOutage(index, row)),
}))

const HOSPITAL = { x: 610, y: 168, width: 220 }
const HOSPITAL_WINDOW = { width: 22, height: 18 }
const HOSPITAL_WINDOW_XS = Array.from({ length: 6 }, (_, i) => 629 + i * 32)
const HOSPITAL_WINDOW_YS = [182, 210, 238]
const SOLAR_PANEL_XS = Array.from({ length: 6 }, (_, i) => 618 + i * 30)
const SIGN = { x: 818, top: 96, size: 34 }

// A tilted panel seen from the front: its top edge leans back and to the right.
function solarPanelPoints(x: number): string {
  const base = HOSPITAL.y - 2
  const top = HOSPITAL.y - 18
  return `${x},${base} ${x + 24},${base} ${x + 29},${top} ${x + 5},${top}`
}

const POLE_TOP_Y = 204
const CABLE_Y = 212
const CABLE_SAG = 14
const LEFT_POLE_XS = [64, 232, 400, 580]
const RIGHT_POLE_XS = [880, 1048, 1216, 1384]
const CABLE_INTO_WALL_Y = 234

// A cable hanging from pole to pole, each span sagging in the middle. A
// quadratic curve's midpoint sits halfway to its control point, hence 2 × sag.
function hangingCable(xs: number[]): string {
  return xs
    .map((x, i) => {
      if (i === 0) return `M ${x} ${CABLE_Y}`
      return `Q ${(xs[i - 1] + x) / 2} ${CABLE_Y + 2 * CABLE_SAG} ${x} ${CABLE_Y}`
    })
    .join(' ')
}

// Both cables are drawn towards the hospital, so the flowing dash runs the way
// the energy travels.
const CABLE_PATHS = [
  `${hangingCable([-20, ...LEFT_POLE_XS])} L ${HOSPITAL.x} ${CABLE_INTO_WALL_Y}`,
  `${hangingCable([VIEW_WIDTH + 20, ...[...RIGHT_POLE_XS].reverse()])} L ${HOSPITAL.x + HOSPITAL.width} ${CABLE_INTO_WALL_Y}`,
]

const BATTERY = { x: 838, y: 260, width: 24, height: 36 }

// Opacity of each animated layer before the grid fails and after.
const BEFORE_BLACKOUT = { city: 1, gridFlow: 1, batteryCharge: 0.3, caption: 0 }
const AFTER_BLACKOUT = { city: 0, gridFlow: 0, batteryCharge: 1, caption: 1 }

// Timings in seconds; the whole sequence is 2.6 s. The last city column starts
// 31 × 40 ms after the grid is lost and fades for 100 ms, ending with the caption.
const FLICKER_AT = 0.9
const FLICKER_SECONDS = 0.36
const GRID_LOST_AT = FLICKER_AT + FLICKER_SECONDS
const COLUMN_STAGGER_SECONDS = 0.04
const COLUMN_FADE_SECONDS = 0.1
const HOSPITAL_DIP_SECONDS = 0.16
const CAPTION_AT = 2.2
const CAPTION_FADE_SECONDS = 0.4
// --ease-out; motion takes a number array, so the CSS token cannot be read here.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

const BLACKOUT: AnimationSequence = [
  // The grid flickers three times, then fails. Each step jumps, like a relay.
  [
    '.hero-scene__grid-flow',
    { opacity: [1, 0, 1, 0, 1, 0, 1, 0] },
    { at: FLICKER_AT, duration: FLICKER_SECONDS, ease: steps(1, 'start') },
  ],
  // The battery takes over: the hospital dips to 30% for 120 ms, then is back
  // at full glow. The dip shows the switch-over; it never goes dark.
  [
    '.hero-scene__hospital-lit',
    { opacity: [1, 0.3, 0.3, 1] },
    { at: GRID_LOST_AT, duration: HOSPITAL_DIP_SECONDS, times: [0, 0.125, 0.875, 1] },
  ],
  [
    '.hero-scene__battery-charge',
    { opacity: [BEFORE_BLACKOUT.batteryCharge, AFTER_BLACKOUT.batteryCharge] },
    { at: GRID_LOST_AT, duration: HOSPITAL_DIP_SECONDS },
  ],
  // The city goes dark column by column, left to right.
  [
    '.hero-scene__city-column',
    { opacity: [1, 0] },
    { at: GRID_LOST_AT, duration: COLUMN_FADE_SECONDS, delay: stagger(COLUMN_STAGGER_SECONDS) },
  ],
  ['.hero-scene__caption', { opacity: [0, 1] }, { at: CAPTION_AT, duration: CAPTION_FADE_SECONDS, ease: EASE_OUT }],
]

export function HeroScene() {
  const reduceMotion = useReducedMotion() === true
  const [scope, animate] = useAnimate<HTMLDivElement>()

  // Plays once on mount. Stopping on cleanup means no animation outlives the page.
  useEffect(() => {
    if (reduceMotion) return
    const blackout = animate(BLACKOUT)
    return () => blackout.stop()
  }, [animate, reduceMotion])

  const opacity = reduceMotion ? AFTER_BLACKOUT : BEFORE_BLACKOUT

  return (
    // Keyed on the motion preference so a change remounts the scene in the right
    // state, instead of keeping whatever a stopped animation left behind.
    <div ref={scope} key={reduceMotion ? 'still' : 'animated'} className="hero-scene">
      <svg
        className="hero-scene__svg"
        viewBox={`0 ${VIEW_TOP} ${VIEW_WIDTH} ${VIEW_BOTTOM - VIEW_TOP}`}
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <g>
          {CITY_BLOCKS.map((block) => (
            <rect
              key={block.x}
              className="hero-scene__block"
              x={block.x}
              y={block.top}
              width={block.width}
              height={GROUND_Y - block.top}
            />
          ))}
          {CITY_COLUMNS.flatMap((column) =>
            column.rows.map((y) => (
              <rect
                key={`${column.x}-${y}`}
                className="hero-scene__window"
                x={column.x}
                y={y}
                width={WINDOW_WIDTH}
                height={WINDOW_HEIGHT}
              />
            )),
          )}
          {CITY_COLUMNS.map((column) => (
            <g key={column.x} className="hero-scene__city-column" style={{ opacity: opacity.city }}>
              {column.litRows.map((y) => (
                <rect
                  key={y}
                  className="hero-scene__window hero-scene__window--lit"
                  x={column.x}
                  y={y}
                  width={WINDOW_WIDTH}
                  height={WINDOW_HEIGHT}
                />
              ))}
            </g>
          ))}
        </g>

        <g>
          {[...LEFT_POLE_XS, ...RIGHT_POLE_XS].map((x) => (
            <g key={x} className="hero-scene__pole">
              <line x1={x} y1={GROUND_Y} x2={x} y2={POLE_TOP_Y} />
              <line x1={x - 14} y1={CABLE_Y} x2={x + 14} y2={CABLE_Y} />
            </g>
          ))}
          {CABLE_PATHS.map((d) => (
            <path key={d} className="hero-scene__cable" d={d} />
          ))}
          <g className="hero-scene__grid-flow" style={{ opacity: opacity.gridFlow }}>
            {CABLE_PATHS.map((d) => (
              <path key={d} className="hero-scene__cable hero-scene__cable--flow power-flow" d={d} />
            ))}
          </g>
        </g>

        <g>
          {SOLAR_PANEL_XS.map((x) => (
            <polygon key={x} className="hero-scene__panel" points={solarPanelPoints(x)} />
          ))}
          <line className="hero-scene__pole" x1={SIGN.x} y1={SIGN.top + SIGN.size} x2={SIGN.x} y2={HOSPITAL.y} />
          <rect
            className="hero-scene__sign"
            x={SIGN.x - SIGN.size / 2}
            y={SIGN.top}
            width={SIGN.size}
            height={SIGN.size}
            rx={3}
          />
          <path
            className="hero-scene__sign-letter"
            d={`M ${SIGN.x - 8} ${SIGN.top + 8} V ${SIGN.top + 26} M ${SIGN.x + 8} ${SIGN.top + 8} V ${SIGN.top + 26} M ${SIGN.x - 8} ${SIGN.top + 17} H ${SIGN.x + 8}`}
          />
          <rect
            className="hero-scene__hospital"
            x={HOSPITAL.x}
            y={HOSPITAL.y}
            width={HOSPITAL.width}
            height={GROUND_Y - HOSPITAL.y}
          />
          <rect className="hero-scene__door" x={706} y={268} width={28} height={GROUND_Y - 268} />
          {HOSPITAL_WINDOW_YS.flatMap((y) =>
            HOSPITAL_WINDOW_XS.map((x) => (
              <rect key={`${x}-${y}`} className="hero-scene__window" x={x} y={y} {...HOSPITAL_WINDOW} />
            )),
          )}
          <g className="hero-scene__hospital-lit">
            {HOSPITAL_WINDOW_YS.flatMap((y) =>
              HOSPITAL_WINDOW_XS.map((x) => <rect key={`${x}-${y}`} x={x} y={y} {...HOSPITAL_WINDOW} />),
            )}
          </g>
        </g>

        <g>
          <rect className="hero-scene__battery" x={BATTERY.x + 7} y={BATTERY.y - 5} width={10} height={5} rx={1} />
          <rect className="hero-scene__battery" {...BATTERY} rx={3} />
          <rect
            className="hero-scene__battery-charge"
            x={BATTERY.x + 5}
            y={BATTERY.y + 6}
            width={BATTERY.width - 10}
            height={BATTERY.height - 11}
            rx={1}
            style={{ opacity: opacity.batteryCharge }}
          />
        </g>

        <rect className="hero-scene__ground" x={0} y={GROUND_Y} width={VIEW_WIDTH} height={VIEW_BOTTOM - GROUND_Y} />
        <line className="hero-scene__street" x1={0} y1={GROUND_Y} x2={VIEW_WIDTH} y2={GROUND_Y} />
      </svg>
      <p className="hero-scene__caption" style={{ opacity: opacity.caption }}>
        Battery took over. No gap.
      </p>
    </div>
  )
}
