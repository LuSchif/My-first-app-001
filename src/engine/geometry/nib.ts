import { traceSegments, type PathSink } from './strokePath.ts'

/**
 * The fountain pen: a broad nib held at an angle draws wide when it moves across the nib's edge
 * and thin when it moves along it, and pressing harder spreads the tines for a wider line.
 * A stroke stores one width per point; it is drawn as the union of a circle at every point and
 * the band between neighbouring circles, so the outline stays smooth however the width changes.
 */

/** The direction of the nib's edge: rising to the right, as a right hand holds a pen. */
const NIB_ANGLE = -Math.PI / 5
/** How thin the line gets when it moves along the edge, as a share of the full width. */
const HAIRLINE = 0.28
/** Distance in points between the circles a stroke is drawn with. */
const FLATTEN_STEP = 1

/** Pressure readings at or below this count as the lightest touch, ... */
const PRESSURE_FLOOR = 0.02
/** ... at or above this as the firmest press. */
const PRESSURE_CEIL = 0.95
/** Moving fast, ink has less time to flow: the line gets up to this share thinner. */
const SPEED_THINNING = 0.3
/** Speeds (page points per ms) between which that thinning sets in. */
const SLOW = 0.3
const FAST = 2.5
/** Line starts and ends taper over this many line widths, ... */
const TAPER_WIDTHS = 1.5
/** ... from this share of the width. */
const TAPER_FROM = 0.65

/** How strongly pressure changes the width by default (see `NibOptions.sensitivity`). */
export const DEFAULT_SENSITIVITY = 0.5

/**
 * Width factor for pressure from 0 to 1; a light touch (0.5 when unknown) keeps about the base
 * width. `sensitivity` from 0 (pressure changes nothing) to 1 (twice the default effect).
 */
export function pressureFactor(pressure: number, sensitivity = DEFAULT_SENSITIVITY): number {
  // The sensor rarely reports the very ends of its range: a resting pen reads a little above 0
  // and a full press a little below 1, so those are stretched to the whole range first.
  const p = Math.min(1, Math.max(0, (pressure - PRESSURE_FLOOR) / (PRESSURE_CEIL - PRESSURE_FLOOR)))
  const full = 0.3 + 1.4 * Math.pow(p, 0.85)
  return Math.max(0.12, 1 + (full - 1) * sensitivity * 2)
}

/** The altitude (degrees) a pen is usually held at while writing: no change in width. */
const WRITING_ALTITUDE = 55

/**
 * Width factor for the pen's tilt: held flatter, the nib touches with more of its side and draws
 * wider; held upright, a little thinner. 1 when the tilt is unknown.
 */
export function tiltFactor(altitudeDeg: number | undefined): number {
  if (altitudeDeg === undefined) return 1
  const lean = (WRITING_ALTITUDE - altitudeDeg) / WRITING_ALTITUDE
  return 1 + 0.6 * Math.min(1, Math.max(-0.3, lean))
}

export interface NibOptions {
  /** How strongly pressure changes the width, from 0 to 1. */
  sensitivity?: number
  /** The pen's altitude at each point, in degrees, where it is known. */
  altitudes?: readonly (number | undefined)[]
  /** The time of each point in ms, for thinning fast strokes. */
  times?: readonly number[]
}

/** Width factor for the pen's speed in page points per ms: 1 when slow, thinner when fast. */
export function speedFactor(speed: number): number {
  const k = Math.min(1, Math.max(0, (speed - SLOW) / (FAST - SLOW)))
  return 1 - SPEED_THINNING * k * k * (3 - 2 * k)
}

/** Width factor `distance` along a line from its start or end: a soft taper. */
export function taperFactor(distance: number, base: number): number {
  const k = Math.min(1, distance / Math.max(1e-6, base * TAPER_WIDTHS))
  return TAPER_FROM + (1 - TAPER_FROM) * Math.sin((k * Math.PI) / 2)
}

/**
 * Tapers the end of a finished line: the widths of its last points, within a few line widths of
 * where the pen lifted (and at most the last third of a short line), in place.
 */
export function taperEnd(points: readonly number[], widths: number[], base: number): void {
  const n = Math.min(points.length / 2, widths.length)
  let total = 0
  for (let i = 1; i < n; i++) {
    total += Math.hypot(
      points[i * 2]! - points[i * 2 - 2]!,
      points[i * 2 + 1]! - points[i * 2 - 1]!,
    )
  }
  const reach = Math.min(base * TAPER_WIDTHS, total / 3)
  let along = 0
  for (let i = n - 1; i >= 0 && along < reach; i--) {
    widths[i] = widths[i]! * taperFactor((along / reach) * base * TAPER_WIDTHS, base)
    if (i > 0) {
      along += Math.hypot(
        points[i * 2]! - points[i * 2 - 2]!,
        points[i * 2 + 1]! - points[i * 2 - 1]!,
      )
    }
  }
}

/** Width factor for a stroke moving in direction (dx, dy). */
export function directionFactor(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 1
  const across = Math.abs(Math.sin(Math.atan2(dy, dx) - NIB_ANGLE))
  return HAIRLINE + (1 - HAIRLINE) * across
}

/**
 * The width at raw point `i`: pressure, tilt, direction against the nib, speed and the taper at
 * the start. It looks only at points before it (and the first three for the very start), so the
 * width of a point never changes while the stroke is still being drawn.
 */
export function nibWidthAt(
  points: readonly number[],
  pressures: readonly number[],
  base: number,
  i: number,
  options: NibOptions = {},
): number {
  const p =
    pressureFactor(pressures[i] ?? 0.5, options.sensitivity) * tiltFactor(options.altitudes?.[i])
  const n = points.length / 2
  const a = i < 2 ? 0 : i - 2
  const b = i < 2 ? Math.min(2, n - 1) : i
  const dx = points[b * 2]! - points[a * 2]!
  const dy = points[b * 2 + 1]! - points[a * 2 + 1]!
  let speed = 1
  const times = options.times
  if (times && times[b] !== undefined && times[a] !== undefined && times[b]! > times[a]!) {
    speed = speedFactor(Math.hypot(dx, dy) / (times[b]! - times[a]!))
  }
  // The start tapers: distance from the first point, counted only as far as the taper reaches.
  let along = 0
  const reach = base * TAPER_WIDTHS
  for (let k = 1; k <= i && along < reach; k++) {
    along += Math.hypot(
      points[k * 2]! - points[k * 2 - 2]!,
      points[k * 2 + 1]! - points[k * 2 - 1]!,
    )
  }
  return base * p * directionFactor(dx, dy) * speed * taperFactor(along, base)
}

/**
 * Points along the curve through `points` (from point `from` to point `to`), about one point
 * apart, as x, y, width triples. Widths are interpolated along each segment.
 */
export function flattenStroke(
  points: readonly number[],
  widths: readonly number[],
  from = 0,
  to = points.length / 2 - 1,
): number[] {
  const out: number[] = [points[from * 2]!, points[from * 2 + 1]!, widths[from]!]
  let seg = from
  let x0 = points[from * 2]!
  let y0 = points[from * 2 + 1]!
  const sink: PathSink = {
    moveTo() {},
    lineTo() {},
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const w0 = widths[seg]!
      const w1 = widths[seg + 1] ?? w0
      const len =
        Math.hypot(c1x - x0, c1y - y0) +
        Math.hypot(c2x - c1x, c2y - c1y) +
        Math.hypot(x - c2x, y - c2y)
      const steps = Math.max(1, Math.ceil(len / FLATTEN_STEP))
      for (let k = 1; k <= steps; k++) {
        const t = k / steps
        const u = 1 - t
        out.push(
          u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
          w0 + (w1 - w0) * t,
        )
      }
      x0 = x
      y0 = y
      seg++
    },
  }
  traceSegments(sink, points, from, to)
  return out
}

/**
 * Adds the shape of a variable-width line to `path`: circles and the bands between them, all
 * wound the same way, so filling with the nonzero rule draws their union. `grow` widens every
 * point, e.g. for a contour around the line.
 */
export function traceNib(
  path: Path2D | CanvasRenderingContext2D,
  flat: readonly number[],
  grow = 0,
): void {
  const n = flat.length / 3
  for (let i = 0; i < n; i++) {
    const x = flat[i * 3]!
    const y = flat[i * 3 + 1]!
    const r = Math.max(0.05, flat[i * 3 + 2]! / 2 + grow)
    path.moveTo(x + r, y)
    path.arc(x, y, r, 0, Math.PI * 2)
    if (i === 0) continue
    const px = flat[i * 3 - 3]!
    const py = flat[i * 3 - 2]!
    const pr = Math.max(0.05, flat[i * 3 - 1]! / 2 + grow)
    const len = Math.hypot(x - px, y - py)
    if (len < 1e-6) continue
    const nx = -(y - py) / len
    const ny = (x - px) / len
    // Same winding as the arcs above.
    path.moveTo(px - nx * pr, py - ny * pr)
    path.lineTo(x - nx * r, y - ny * r)
    path.lineTo(x + nx * r, y + ny * r)
    path.lineTo(px + nx * pr, py + ny * pr)
    path.closePath()
  }
}
