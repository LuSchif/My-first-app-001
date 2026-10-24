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

/** Width factor for pressure from 0 to 1; a light touch (0.5 when unknown) keeps the base width. */
export function pressureFactor(pressure: number): number {
  const p = Math.min(1, Math.max(0, pressure))
  return 0.3 + 1.4 * Math.pow(p, 0.85)
}

/** Width factor for a stroke moving in direction (dx, dy). */
export function directionFactor(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 1
  const across = Math.abs(Math.sin(Math.atan2(dy, dx) - NIB_ANGLE))
  return HAIRLINE + (1 - HAIRLINE) * across
}

/**
 * The width at raw point `i`. It looks only at points before it (and the first three for the
 * very start), so the width of a point never changes while the stroke is still being drawn.
 */
export function nibWidthAt(
  points: readonly number[],
  pressures: readonly number[],
  base: number,
  i: number,
): number {
  const p = pressureFactor(pressures[i] ?? 0.5)
  const n = points.length / 2
  const a = i < 2 ? 0 : i - 2
  const b = i < 2 ? Math.min(2, n - 1) : i
  const dx = points[b * 2]! - points[a * 2]!
  const dy = points[b * 2 + 1]! - points[a * 2 + 1]!
  return base * p * directionFactor(dx, dy)
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
