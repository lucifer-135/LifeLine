import type { Ward } from '../../engine/types'

// Floor-plan geometry for HospitalMap, in SVG user units. Text is set in the same units,
// so each layout is drawn for the width it is shown at: "wide" for a map column of
// about 550 to 750 px, "narrow" for a phone. The rooms keep their order in both.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type WallSide = 'top' | 'right' | 'bottom' | 'left'

// A door is a gap in one wall, `offset` units from the start of that wall going
// clockwise (left to right along the top, right to left along the bottom).
export interface Door {
  side: WallSide
  offset: number
}

export interface PlanRoom extends Rect {
  door: Door
}

export type WardRoomId = 'ICU' | 'Theatre' | 'Maternity' | 'ColdChain' | 'Lab' | 'Wards' | 'Admin'

export interface WardRoom {
  id: WardRoomId
  name: string
  wards: readonly Ward[]
}

// Most critical care first. "Wards" also holds the utilities (security lights, water
// pump), which have no room of their own on the plan.
export const WARD_ROOMS: readonly WardRoom[] = [
  { id: 'ICU', name: 'ICU', wards: ['ICU'] },
  { id: 'Theatre', name: 'Theatre', wards: ['Theatre'] },
  { id: 'Maternity', name: 'Maternity', wards: ['Maternity'] },
  { id: 'ColdChain', name: 'Cold chain', wards: ['ColdChain'] },
  { id: 'Lab', name: 'Lab', wards: ['Lab'] },
  { id: 'Wards', name: 'Wards', wards: ['Wards', 'Utilities'] },
  { id: 'Admin', name: 'Admin', wards: ['Admin'] },
]

export interface MapLayout {
  width: number
  height: number
  rooms: Record<WardRoomId, PlanRoom>
  battery: PlanRoom
  generator: PlanRoom
  roofLabel: { x: number; y: number }
  panels: Rect[]
  // The grid cable runs along `y` from the left edge to a meter, then into the building.
  grid: { y: number; meterX: number; buildingX: number }
}

const PANEL_COUNT = 6

function panelRow(x: number, y: number, width: number, height: number, gap: number): Rect[] {
  return Array.from({ length: PANEL_COUNT }, (_, i) => ({ x: x + i * (width + gap), y, width, height }))
}

// Three wards over a corridor, four below it, then the plant rooms.
export const WIDE_LAYOUT: MapLayout = {
  width: 640,
  height: 440,
  rooms: {
    ICU: { x: 56, y: 56, width: 200, height: 120, door: { side: 'bottom', offset: 80 } },
    Theatre: { x: 256, y: 56, width: 188, height: 120, door: { side: 'bottom', offset: 80 } },
    Maternity: { x: 444, y: 56, width: 188, height: 120, door: { side: 'bottom', offset: 80 } },
    ColdChain: { x: 56, y: 200, width: 144, height: 112, door: { side: 'top', offset: 60 } },
    Lab: { x: 200, y: 200, width: 144, height: 112, door: { side: 'top', offset: 60 } },
    Wards: { x: 344, y: 200, width: 144, height: 112, door: { side: 'top', offset: 60 } },
    Admin: { x: 488, y: 200, width: 144, height: 112, door: { side: 'top', offset: 60 } },
  },
  battery: { x: 56, y: 312, width: 288, height: 116, door: { side: 'bottom', offset: 200 } },
  generator: { x: 344, y: 312, width: 288, height: 116, door: { side: 'bottom', offset: 40 } },
  roofLabel: { x: 56, y: 33 },
  panels: panelRow(200, 14, 64, 26, 9),
  grid: { y: 384, meterX: 40, buildingX: 56 },
}

// Two rooms a row, so the labels stay readable at phone width.
export const NARROW_LAYOUT: MapLayout = {
  width: 360,
  height: 608,
  rooms: {
    ICU: { x: 40, y: 52, width: 156, height: 104, door: { side: 'top', offset: 60 } },
    Theatre: { x: 196, y: 52, width: 156, height: 104, door: { side: 'top', offset: 60 } },
    Maternity: { x: 40, y: 156, width: 156, height: 104, door: { side: 'bottom', offset: 60 } },
    ColdChain: { x: 196, y: 156, width: 156, height: 104, door: { side: 'bottom', offset: 60 } },
    Lab: { x: 40, y: 284, width: 156, height: 104, door: { side: 'top', offset: 60 } },
    Wards: { x: 196, y: 284, width: 156, height: 104, door: { side: 'top', offset: 60 } },
    Admin: { x: 196, y: 388, width: 156, height: 104, door: { side: 'right', offset: 60 } },
  },
  battery: { x: 40, y: 388, width: 156, height: 104, door: { side: 'left', offset: 70 } },
  generator: { x: 40, y: 492, width: 312, height: 104, door: { side: 'bottom', offset: 40 } },
  roofLabel: { x: 40, y: 31 },
  panels: panelRow(128, 12, 32, 24, 6),
  grid: { y: 462, meterX: 24, buildingX: 40 },
}

const DOOR_WIDTH = 12
const SIDE_ORDER: WallSide[] = ['top', 'right', 'bottom', 'left']

// The room's four walls as one open path that leaves out the door gap. Walls shared with a
// neighbour are drawn by both rooms, so doors sit on corridor or outside walls only.
export function wallPath({ x, y, width, height }: Rect, door: Door): string {
  const corners: [number, number][] = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]
  const side = SIDE_ORDER.indexOf(door.side)
  const corner = (i: number) => corners[(side + i) % corners.length]
  const [sx, sy] = corner(0)
  const [ex, ey] = corner(1)
  const length = Math.hypot(ex - sx, ey - sy)
  const along = (distance: number): [number, number] => [
    sx + ((ex - sx) / length) * distance,
    sy + ((ey - sy) / length) * distance,
  ]
  const points = [along(door.offset + DOOR_WIDTH), corner(1), corner(2), corner(3), corner(0), along(door.offset)]
  return `M ${points.map(([px, py]) => `${px} ${py}`).join(' L ')}`
}
