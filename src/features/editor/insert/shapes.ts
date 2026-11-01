import type { BoxFrame, Id, StrokeObject } from '../../../engine/model/types.ts'
import { newId } from '../../../engine/model/ids.ts'

/**
 * Ready-made shapes for the insert panel. Each is drawn with the pen's color and size as an
 * ordinary stroke, so it can be recolored, filled, resized and edited like a drawn shape.
 * Points are given in a unit box (0 to 1 across and down) and stretched to the shape's size.
 */
export interface ShapeDef {
  id: string
  label: string
  /** Size it is added at, in points. */
  width: number
  height: number
  points: number[]
  closed: boolean
  /** Straight edges between the points; otherwise a smooth curve through them. */
  straight: boolean
}

function ring(count: number, at: (t: number) => [number, number]): number[] {
  return Array.from({ length: count }, (_, i) => at((i / count) * Math.PI * 2)).flat()
}

function polygon(sides: number, turn = -Math.PI / 2): number[] {
  return ring(sides, (t) => [0.5 + 0.5 * Math.cos(t + turn), 0.5 + 0.5 * Math.sin(t + turn)])
}

function star(tips: number, inner: number): number[] {
  return ring(tips * 2, (t) => {
    const r = Math.round((t / (Math.PI * 2)) * tips * 2) % 2 ? inner : 0.5
    return [0.5 + r * Math.cos(t - Math.PI / 2), 0.5 + r * Math.sin(t - Math.PI / 2)]
  })
}

/** A rectangle with round corners, traced corner by corner. */
function rounded(r: number, rx = r): number[] {
  const out: number[] = []
  const corners: [number, number, number][] = [
    [1 - rx, r, -Math.PI / 2],
    [1 - rx, 1 - r, 0],
    [rx, 1 - r, Math.PI / 2],
    [rx, r, Math.PI],
  ]
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2)
      out.push(cx + rx * Math.cos(a), cy + r * Math.sin(a))
    }
  }
  return out
}

function heart(): number[] {
  // The classic heart curve, scaled into the unit box.
  const pts = ring(64, (t) => [
    16 * Math.sin(t) ** 3,
    -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
  ])
  return pts.map((v, i) => (i % 2 ? (v + 17) / 30 : (v + 16) / 32))
}

function bubble(): number[] {
  // A rounded box with a tail at the bottom left.
  const box = rounded(0.12, 0.08).map((v, i) => (i % 2 ? v * 0.8 : v))
  const tail = [0.3, 0.8, 0.16, 1, 0.2, 0.8]
  // The box's bottom edge runs from right to left; the tail goes in between.
  const bottomStart = 7 * 2 * 2
  return [...box.slice(0, bottomStart), ...tail, ...box.slice(bottomStart)]
}

export const SHAPES: ShapeDef[] = [
  {
    id: 'line',
    label: 'Line',
    width: 200,
    height: 20,
    points: [0, 0.5, 1, 0.5],
    closed: false,
    straight: true,
  },
  {
    id: 'arrow',
    label: 'Arrow',
    width: 200,
    height: 60,
    points: [0, 0.5, 1, 0.5, 0.86, 0.15, 1, 0.5, 0.86, 0.85],
    closed: false,
    straight: true,
  },
  {
    id: 'double-arrow',
    label: 'Double arrow',
    width: 220,
    height: 60,
    points: [0.14, 0.15, 0, 0.5, 0.14, 0.85, 0, 0.5, 1, 0.5, 0.86, 0.15, 1, 0.5, 0.86, 0.85],
    closed: false,
    straight: true,
  },
  {
    id: 'square',
    label: 'Square',
    width: 140,
    height: 140,
    points: [0, 0, 1, 0, 1, 1, 0, 1],
    closed: true,
    straight: true,
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    width: 200,
    height: 130,
    points: [0, 0, 1, 0, 1, 1, 0, 1],
    closed: true,
    straight: true,
  },
  {
    id: 'rounded',
    label: 'Rounded box',
    width: 200,
    height: 130,
    points: rounded(0.18, 0.12),
    closed: true,
    straight: true,
  },
  {
    id: 'circle',
    label: 'Circle',
    width: 140,
    height: 140,
    points: polygon(72),
    closed: true,
    straight: true,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    width: 200,
    height: 130,
    points: polygon(72),
    closed: true,
    straight: true,
  },
  {
    id: 'triangle',
    label: 'Triangle',
    width: 150,
    height: 130,
    points: [0.5, 0, 1, 1, 0, 1],
    closed: true,
    straight: true,
  },
  {
    id: 'right-triangle',
    label: 'Right triangle',
    width: 150,
    height: 130,
    points: [0, 0, 1, 1, 0, 1],
    closed: true,
    straight: true,
  },
  {
    id: 'diamond',
    label: 'Diamond',
    width: 140,
    height: 160,
    points: [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5],
    closed: true,
    straight: true,
  },
  {
    id: 'pentagon',
    label: 'Pentagon',
    width: 150,
    height: 145,
    points: polygon(5),
    closed: true,
    straight: true,
  },
  {
    id: 'hexagon',
    label: 'Hexagon',
    width: 160,
    height: 140,
    points: polygon(6, 0),
    closed: true,
    straight: true,
  },
  {
    id: 'star',
    label: 'Star',
    width: 150,
    height: 145,
    points: star(5, 0.21),
    closed: true,
    straight: true,
  },
  {
    id: 'heart',
    label: 'Heart',
    width: 150,
    height: 140,
    points: heart(),
    closed: true,
    straight: true,
  },
  {
    id: 'bubble',
    label: 'Speech bubble',
    width: 200,
    height: 150,
    points: bubble(),
    closed: true,
    straight: true,
  },
]

/** The shape as a stroke filling a frame, in the pen's color and size. */
export function shapeStroke(
  shape: ShapeDef,
  frame: BoxFrame,
  layerId: Id,
  pen: { color: string; width: number },
): StrokeObject {
  return {
    id: newId(),
    type: 'stroke',
    layerId,
    tool: 'pen',
    color: pen.color,
    width: Math.max(1.5, pen.width),
    opacity: 1,
    points: shape.points.map((v, i) =>
      i % 2 ? frame.y + v * frame.height : frame.x + v * frame.width,
    ),
    ...(shape.closed ? { closed: true } : {}),
    ...(shape.straight ? { straight: true } : {}),
  }
}

/** The shape as an SVG path in a box of the given size, for its button. */
export function shapePath(shape: ShapeDef, size: number): string {
  const k = Math.min(size / shape.width, size / shape.height)
  const w = shape.width * k
  const h = Math.max(shape.height * k, 2)
  const ox = (size - w) / 2
  const oy = (size - h) / 2
  let d = ''
  for (let i = 0; i + 1 < shape.points.length; i += 2) {
    d += `${i ? 'L' : 'M'}${(ox + shape.points[i]! * w).toFixed(1)} ${(oy + shape.points[i + 1]! * h).toFixed(1)}`
  }
  return shape.closed ? `${d}Z` : d
}
