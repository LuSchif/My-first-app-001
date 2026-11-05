/**
 * The shape of a stroke. This is the only place the curve is defined, so live ink, saved strokes
 * and exports always match.
 *
 * 1. `smoothPoints` evens out hand and sensor jitter with a binomial kernel over seven samples.
 *    The ends stay where the pen touched down and lifted.
 * 2. `traceStroke` draws a centripetal Catmull-Rom spline through the smoothed points, as cubic
 *    Bézier segments. Unlike curves that bend only at the samples, it spreads the curvature
 *    evenly, so fast handwriting with sparse samples still reads as round, not angular.
 */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void
}

const KERNEL = [1, 6, 15, 20, 15, 6, 1] as const
const KERNEL_SUM = 64
/** How many raw points on each side a smoothed point depends on. */
export const SMOOTH_RADIUS = 3

/** The smoothed position of point `i`, from raw points `i - 3` to `i + 3`. */
export function smoothedAt(raw: readonly number[], i: number): [number, number] {
  const n = raw.length / 2
  if (i <= 0 || i >= n - 1) return [raw[i * 2]!, raw[i * 2 + 1]!]
  let x = 0
  let y = 0
  for (let k = 0; k < KERNEL.length; k++) {
    const j = Math.min(n - 1, Math.max(0, i + k - SMOOTH_RADIUS))
    x += raw[j * 2]! * KERNEL[k]!
    y += raw[j * 2 + 1]! * KERNEL[k]!
  }
  return [x / KERNEL_SUM, y / KERNEL_SUM]
}

/** The same smoothing for a single value per point, e.g. the line width of a fountain pen. */
export function smoothedValueAt(raw: readonly number[], i: number): number {
  const n = raw.length
  if (i <= 0 || i >= n - 1) return raw[i]!
  let v = 0
  for (let k = 0; k < KERNEL.length; k++) {
    v += raw[Math.min(n - 1, Math.max(0, i + k - SMOOTH_RADIUS))]! * KERNEL[k]!
  }
  return v / KERNEL_SUM
}

export function smoothPoints(raw: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < raw.length / 2; i++) out.push(...smoothedAt(raw, i))
  return out
}

/**
 * A light finish for a stroke just written: every inner point moves a quarter of the way
 * towards the middle of its neighbours. That evens out the last bit of sensor wobble but moves
 * a point by a fraction of a pixel at most, so the finished stroke looks the same as the one
 * drawn live; the ends stay where the pen touched down and lifted.
 */
export function finishPoints(points: readonly number[]): number[] {
  const n = points.length / 2
  const out = points.slice()
  for (let i = 1; i < n - 1; i++) {
    for (const k of [0, 1]) {
      out[i * 2 + k] =
        (points[i * 2 - 2 + k]! + 2 * points[i * 2 + k]! + points[i * 2 + 2 + k]!) / 4
    }
  }
  return out
}

/** The distance along a line from its first point to each point. */
export function lengthsAlong(points: readonly number[]): number[] {
  const along = [0]
  for (let i = 1; i < points.length / 2; i++) {
    along.push(
      along[i - 1]! +
        Math.hypot(points[i * 2]! - points[i * 2 - 2]!, points[i * 2 + 1]! - points[i * 2 - 1]!),
    )
  }
  return along
}

/**
 * Point `i` of a line smoothed along its own length: the Gaussian-weighted average of the
 * points within three `sigma` (same units as the points) of it, measured along the line
 * (`along` from `lengthsAlong`). Past either end the line is mirrored through its end point, so
 * the ends stay where they are and keep their direction, with no hook. A point further than
 * three sigma from the end never changes as the line grows, so a line being drawn can be
 * smoothed as it goes and stay exactly as drawn.
 */
export function smoothedAlongAt(
  points: readonly number[],
  along: readonly number[],
  i: number,
  sigma: number,
): [number, number] {
  const n = along.length
  if (sigma <= 0 || n < 3) return [points[i * 2]!, points[i * 2 + 1]!]
  const reach = sigma * 3
  const k = 1 / (2 * sigma * sigma)
  const si = along[i]!
  const total = along[n - 1]!
  let sx = 0
  let sy = 0
  let sw = 0
  const add = (x: number, y: number, d: number) => {
    const w = Math.exp(-d * d * k)
    sx += x * w
    sy += y * w
    sw += w
  }
  let lo = i
  while (lo > 0 && si - along[lo - 1]! <= reach) lo--
  let hi = i
  while (hi < n - 1 && along[hi + 1]! - si <= reach) hi++
  for (let j = lo; j <= hi; j++) add(points[j * 2]!, points[j * 2 + 1]!, along[j]! - si)
  // The mirror image past the start, ...
  const x0 = points[0]!
  const y0 = points[1]!
  for (let j = 1; j < n && along[j]! + si <= reach; j++) {
    add(2 * x0 - points[j * 2]!, 2 * y0 - points[j * 2 + 1]!, along[j]! + si)
  }
  // ... and past the end.
  const xn = points[(n - 1) * 2]!
  const yn = points[(n - 1) * 2 + 1]!
  for (let j = n - 2; j >= 0 && 2 * total - along[j]! - si <= reach; j--) {
    add(2 * xn - points[j * 2]!, 2 * yn - points[j * 2 + 1]!, 2 * total - along[j]! - si)
  }
  return [sx / sw, sy / sw]
}

/** A whole line smoothed along its length (see `smoothedAlongAt`). */
export function smoothAlong(points: readonly number[], sigma: number): number[] {
  const along = lengthsAlong(points)
  const out: number[] = []
  for (let i = 0; i < along.length; i++) out.push(...smoothedAlongAt(points, along, i, sigma))
  return out
}

export interface TraceOptions {
  /** Connects the last point back to the first. */
  closed?: boolean
  /** Straight lines between the points (polygons) instead of a smooth curve. */
  straight?: boolean
}

export function traceStroke(
  sink: PathSink & { closePath?: () => void },
  points: readonly number[],
  options: TraceOptions = {},
): void {
  const n = points.length / 2
  if (n === 0) return
  sink.moveTo(points[0]!, points[1]!)
  if (n === 1) {
    // A zero-length segment draws a round dot with round caps.
    sink.lineTo(points[0]! + 0.001, points[1]!)
    return
  }
  if (options.straight) {
    for (let i = 1; i < n; i++) sink.lineTo(points[i * 2]!, points[i * 2 + 1]!)
  } else if (options.closed) {
    traceClosedSegments(sink, points)
  } else {
    traceSegments(sink, points, 0, n - 1)
  }
  if (options.closed) sink.closePath?.()
}

/** Draws a vector path: a start point, then six numbers per cubic segment. */
export function tracePath(
  sink: PathSink & { closePath?: () => void },
  path: readonly number[],
  closed = false,
): void {
  if (path.length < 2) return
  sink.moveTo(path[0]!, path[1]!)
  if (path.length < 8) {
    sink.lineTo(path[0]! + 0.001, path[1]!)
    return
  }
  for (let i = 2; i + 5 < path.length; i += 6) {
    sink.bezierCurveTo(
      path[i]!,
      path[i + 1]!,
      path[i + 2]!,
      path[i + 3]!,
      path[i + 4]!,
      path[i + 5]!,
    )
  }
  if (closed) sink.closePath?.()
}

/** A smooth loop: every segment, including last-to-first, uses its wrapped-around neighbours. */
function traceClosedSegments(sink: PathSink, points: readonly number[]): void {
  const n = points.length / 2
  const at = (i: number) => {
    const k = ((i % n) + n) % n
    return [points[k * 2]!, points[k * 2 + 1]!] as const
  }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1)
    const [x1, y1] = at(i)
    const [x2, y2] = at(i + 1)
    const [x3, y3] = at(i + 2)
    const [c1x, c1y, c2x, c2y] = catmullRomControls(x0, y0, x1, y1, x2, y2, x3, y3)
    sink.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2)
  }
}

/**
 * Appends curve segments `from` to `to - 1`; segment `i` runs near points `i` to `i + 1`.
 * The path must already be at `curveStart(points, from)`. A segment depends on points `i - 1`
 * to `i + 2` (the last one also on the end), so
 * once those exist it never changes: the editor draws settled segments once and only redraws
 * the end.
 */
export function traceSegments(
  sink: PathSink,
  points: readonly number[],
  from: number,
  to: number,
): void {
  for (let i = from; i < to; i++) {
    const [, , c1x, c1y, c2x, c2y, x, y] = bSplineSegment(points, i)
    sink.bezierCurveTo(c1x, c1y, c2x, c2y, x, y)
  }
}

/** Where curve segment `i` starts: the point to move to before tracing from segment `i`. */
export function curveStart(points: readonly number[], i: number): [number, number] {
  const seg = bSplineSegment(points, i)
  return [seg[0], seg[1]]
}

/** Point `i`, or beyond either end its mirror image, so the curve ends exactly at the ends. */
function pointAt(points: readonly number[], i: number): [number, number] {
  const n = points.length / 2
  if (i < 0) {
    return [2 * points[0]! - points[2]!, 2 * points[1]! - points[3]!]
  }
  if (i > n - 1) {
    return [
      2 * points[(n - 1) * 2]! - points[(n - 2) * 2]!,
      2 * points[(n - 1) * 2 + 1]! - points[(n - 2) * 2 + 1]!,
    ]
  }
  return [points[i * 2]!, points[i * 2 + 1]!]
}

/**
 * Segment `i` of a uniform cubic B-spline with the points as its control points, as a Bézier:
 * start, two controls, end. Unlike a curve through the points, it bends gradually everywhere
 * (its curvature is continuous), so even sparse samples of fast writing make a round line, not
 * a polygon with corners; it passes within a fraction of each turn of the samples, and starts
 * and ends exactly at the first and last point.
 */
export function bSplineSegment(
  points: readonly number[],
  i: number,
): [number, number, number, number, number, number, number, number] {
  if (points.length < 4) {
    const x = points[0]!
    const y = points[1]!
    return [x, y, x, y, x, y, x, y]
  }
  const [x0, y0] = pointAt(points, i - 1)
  const [x1, y1] = pointAt(points, i)
  const [x2, y2] = pointAt(points, i + 1)
  const [x3, y3] = pointAt(points, i + 2)
  return [
    (x0 + 4 * x1 + x2) / 6,
    (y0 + 4 * y1 + y2) / 6,
    (2 * x1 + x2) / 3,
    (2 * y1 + y2) / 3,
    (x1 + 2 * x2) / 3,
    (y1 + 2 * y2) / 3,
    (x1 + 4 * x2 + x3) / 6,
    (y1 + 4 * y2 + y3) / 6,
  ]
}

/**
 * Bézier control points for the centripetal (alpha = 0.5) Catmull-Rom segment from p1 to p2.
 * Centripetal parametrization never forms cusps or loops when samples are unevenly spaced.
 */
export function catmullRomControls(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): [number, number, number, number] {
  const d1 = Math.hypot(x1 - x0, y1 - y0)
  const d2 = Math.hypot(x2 - x1, y2 - y1)
  const d3 = Math.hypot(x3 - x2, y3 - y2)
  const r1 = Math.sqrt(d1)
  const r2 = Math.sqrt(d2)
  const r3 = Math.sqrt(d3)

  let c1x: number
  let c1y: number
  if (d1 < 1e-6 || d2 < 1e-6) {
    c1x = x1 + (x2 - x1) / 3
    c1y = y1 + (y2 - y1) / 3
  } else {
    const k = 3 * r1 * (r1 + r2)
    const m = 2 * d1 + 3 * r1 * r2 + d2
    c1x = (d1 * x2 - d2 * x0 + m * x1) / k
    c1y = (d1 * y2 - d2 * y0 + m * y1) / k
  }

  let c2x: number
  let c2y: number
  if (d3 < 1e-6 || d2 < 1e-6) {
    c2x = x2 - (x2 - x1) / 3
    c2y = y2 - (y2 - y1) / 3
  } else {
    const k = 3 * r3 * (r3 + r2)
    const m = 2 * d3 + 3 * r3 * r2 + d2
    c2x = (d3 * x1 - d2 * x3 + m * x2) / k
    c2y = (d3 * y1 - d2 * y3 + m * y2) / k
  }
  return [c1x, c1y, c2x, c2y]
}
