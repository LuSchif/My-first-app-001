/**
 * The shape of a stroke. This is the only place the curve is defined, so live ink, saved strokes
 * and exports always match.
 *
 * 1. `smoothPoints` evens out hand and sensor jitter with a small [1 4 6 4 1] kernel. The ends
 *    stay where the pen touched down and lifted.
 * 2. `traceStroke` draws a centripetal Catmull-Rom spline through the smoothed points, as cubic
 *    Bézier segments. Unlike curves that bend only at the samples, it spreads the curvature
 *    evenly, so fast handwriting with sparse samples still reads as round, not angular.
 */
export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void
}

const KERNEL = [1, 4, 6, 4, 1] as const

/** The smoothed position of point `i`, from raw points `i - 2` to `i + 2`. */
export function smoothedAt(raw: readonly number[], i: number): [number, number] {
  const n = raw.length / 2
  if (i <= 0 || i >= n - 1) return [raw[i * 2]!, raw[i * 2 + 1]!]
  let x = 0
  let y = 0
  for (let k = 0; k < 5; k++) {
    const j = Math.min(n - 1, Math.max(0, i + k - 2))
    x += raw[j * 2]! * KERNEL[k]!
    y += raw[j * 2 + 1]! * KERNEL[k]!
  }
  return [x / 16, y / 16]
}

export function smoothPoints(raw: readonly number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < raw.length / 2; i++) out.push(...smoothedAt(raw, i))
  return out
}

export function traceStroke(sink: PathSink, points: readonly number[]): void {
  const n = points.length / 2
  if (n === 0) return
  sink.moveTo(points[0]!, points[1]!)
  if (n === 1) {
    // A zero-length segment draws a round dot with round caps.
    sink.lineTo(points[0]! + 0.001, points[1]!)
    return
  }
  traceSegments(sink, points, 0, n - 1)
}

/**
 * Appends curve segments `from` to `to - 1`; segment `i` runs from point `i` to point `i + 1`.
 * The path must already be at point `from`. A segment depends on points `i - 1` to `i + 2`, so
 * once those exist it never changes: the editor draws settled segments once and only redraws
 * the end.
 */
export function traceSegments(
  sink: PathSink,
  points: readonly number[],
  from: number,
  to: number,
): void {
  const n = points.length / 2
  for (let i = from; i < to; i++) {
    const a = Math.max(0, i - 1)
    const d = Math.min(n - 1, i + 2)
    const x0 = points[a * 2]!
    const y0 = points[a * 2 + 1]!
    const x1 = points[i * 2]!
    const y1 = points[i * 2 + 1]!
    const x2 = points[i * 2 + 2]!
    const y2 = points[i * 2 + 3]!
    const x3 = points[d * 2]!
    const y3 = points[d * 2 + 1]!
    const [c1x, c1y, c2x, c2y] = catmullRomControls(x0, y0, x1, y1, x2, y2, x3, y3)
    sink.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2)
  }
}

/**
 * Bézier control points for the centripetal (alpha = 0.5) Catmull-Rom segment from p1 to p2.
 * Centripetal parametrization never forms cusps or loops when samples are unevenly spaced.
 */
function catmullRomControls(
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
