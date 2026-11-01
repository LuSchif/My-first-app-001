import type { BoxFrame, Id, StrokeObject } from '../../../engine/model/types.ts'
import { samplePath } from '../../../engine/geometry/fitCurve.ts'
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
  /**
   * Round shapes as true curves: a path of cubic Bézier segments (start point, then two control
   * points and an end point per segment), so the corners are smooth and few anchors are needed.
   */
  path?: number[]
}

/** Control point distance for a quarter circle drawn as one cubic Bézier segment. */
const KAPPA = 0.5523

/** Builds a path: straight lines and quarter-ellipse corners, as cubic segments. */
class PathBuilder {
  readonly out: number[]
  private x: number
  private y: number
  constructor(x: number, y: number) {
    this.out = [x, y]
    this.x = x
    this.y = y
  }
  line(x: number, y: number): this {
    const { x: x0, y: y0 } = this
    this.out.push(
      x0 + (x - x0) / 3,
      y0 + (y - y0) / 3,
      x0 + ((x - x0) * 2) / 3,
      y0 + ((y - y0) * 2) / 3,
      x,
      y,
    )
    this.x = x
    this.y = y
    return this
  }
  curve(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    this.out.push(c1x, c1y, c2x, c2y, x, y)
    this.x = x
    this.y = y
    return this
  }
  /** A quarter ellipse to (x, y); `horizontalFirst` leaves the current point sideways. */
  corner(x: number, y: number, horizontalFirst: boolean): this {
    const { x: x0, y: y0 } = this
    return horizontalFirst
      ? this.curve(x0 + (x - x0) * KAPPA, y0, x, y - (y - y0) * KAPPA, x, y)
      : this.curve(x0, y0 + (y - y0) * KAPPA, x - (x - x0) * KAPPA, y, x, y)
  }
}

function ellipsePath(): number[] {
  return new PathBuilder(1, 0.5)
    .corner(0.5, 1, false)
    .corner(0, 0.5, true)
    .corner(0.5, 0, false)
    .corner(1, 0.5, true).out
}

/** A box with round corners; `bottom` is where the box ends (a bubble's tail goes below). */
function roundedPath(rx: number, ry: number, bottom = 1, tail = false): number[] {
  const b = new PathBuilder(rx, 0)
    .line(1 - rx, 0)
    .corner(1, ry, true)
    .line(1, bottom - ry)
    .corner(1 - rx, bottom, false)
  if (tail) b.line(0.34, bottom).line(0.16, 1).line(0.22, bottom)
  return b
    .line(rx, bottom)
    .corner(0, bottom - ry, true)
    .line(0, ry)
    .corner(rx, 0, false).out
}

function heartPath(): number[] {
  return new PathBuilder(0.5, 0.28)
    .curve(0.5, 0.04, 0.88, -0.04, 0.98, 0.24)
    .curve(1.06, 0.52, 0.72, 0.74, 0.5, 1)
    .curve(0.28, 0.74, -0.06, 0.52, 0.02, 0.24)
    .curve(0.12, -0.04, 0.5, 0.04, 0.5, 0.28).out
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
    points: [],
    path: roundedPath(0.12, 0.18),
    closed: true,
    straight: false,
  },
  {
    id: 'circle',
    label: 'Circle',
    width: 140,
    height: 140,
    points: [],
    path: ellipsePath(),
    closed: true,
    straight: false,
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    width: 200,
    height: 130,
    points: [],
    path: ellipsePath(),
    closed: true,
    straight: false,
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
    points: [],
    path: heartPath(),
    closed: true,
    straight: false,
  },
  {
    id: 'bubble',
    label: 'Speech bubble',
    width: 200,
    height: 150,
    points: [],
    path: roundedPath(0.09, 0.14, 0.8, true),
    closed: true,
    straight: false,
  },
]

/** The shape as a stroke filling a frame, in the pen's color and size. */
export function shapeStroke(
  shape: ShapeDef,
  frame: BoxFrame,
  layerId: Id,
  pen: { color: string; width: number },
): StrokeObject {
  const place = (unit: readonly number[]) =>
    unit.map((v, i) => (i % 2 ? frame.y + v * frame.height : frame.x + v * frame.width))
  const path = shape.path ? place(shape.path) : null
  return {
    id: newId(),
    type: 'stroke',
    layerId,
    tool: 'pen',
    color: pen.color,
    width: Math.max(1.5, pen.width),
    opacity: 1,
    points: path ? samplePath(path) : place(shape.points),
    ...(path ? { path } : {}),
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
  const x = (v: number) => (ox + v * w).toFixed(1)
  const y = (v: number) => (oy + v * h).toFixed(1)
  const p = shape.path
  if (p) {
    let d = `M${x(p[0]!)} ${y(p[1]!)}`
    for (let i = 2; i + 5 < p.length; i += 6) {
      d += `C${x(p[i]!)} ${y(p[i + 1]!)} ${x(p[i + 2]!)} ${y(p[i + 3]!)} ${x(p[i + 4]!)} ${y(p[i + 5]!)}`
    }
    return `${d}Z`
  }
  let d = ''
  for (let i = 0; i + 1 < shape.points.length; i += 2) {
    d += `${i ? 'L' : 'M'}${x(shape.points[i]!)} ${y(shape.points[i + 1]!)}`
  }
  return shape.closed ? `${d}Z` : d
}
