import type { Rect } from '../geometry/rect.ts'
import type { GestureSettings, GestureStroke } from './types.ts'

/**
 * Recognizing drawn commands. A drawing (one or more strokes) is compared with an addon's
 * `before` drawing as a cloud of points (after the $P recognizer, Vatavu et al.): stroke order
 * and direction do not matter. Both are first stretched to fill the same square, so a pair of
 * brackets matches however far apart they are drawn; only shape counts, not size or spacing.
 */

/** Points each drawing is resampled to. */
const SAMPLES = 40
/** Mean distance (in the unit square) below which a drawing matches, strict to loose. */
const THRESHOLD = [0.05, 0.16] as const

/** Strokes of a drawing as flat x, y lists. */
export type Drawing = readonly (readonly number[])[]

/** The bounding box of all points of a drawing; null when it has none. */
export function drawingBounds(drawing: Drawing): Rect | null {
  let r: Rect | null = null
  for (const pts of drawing) {
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x = pts[i]!
      const y = pts[i + 1]!
      if (!r) r = { minX: x, minY: y, maxX: x, maxY: y }
      else {
        r.minX = Math.min(r.minX, x)
        r.minY = Math.min(r.minY, y)
        r.maxX = Math.max(r.maxX, x)
        r.maxY = Math.max(r.maxY, y)
      }
    }
  }
  return r
}

/** How far `drawing` is from `template` (0 = the same shape); Infinity when it cannot match. */
export function gestureDistance(drawing: Drawing, template: Drawing): number {
  if (drawing.length !== template.length || drawing.length === 0) return Infinity
  const a = normalize(drawing)
  const b = normalize(template)
  if (!a || !b) return Infinity
  return Math.min(cloudDistance(a, b, 0), cloudDistance(b, a, 0)) / SAMPLES
}

/** Whether `drawing` matches the addon's `before` drawing. */
export function matchesGesture(drawing: Drawing, settings: GestureSettings): boolean {
  if (settings.before.length === 0 || settings.after.length === 0) return false
  const t = Math.min(1, Math.max(0, settings.tolerance))
  const limit = THRESHOLD[0] + (THRESHOLD[1] - THRESHOLD[0]) * t
  return (
    gestureDistance(
      drawing,
      settings.before.map((s) => s.points),
    ) <= limit
  )
}

/**
 * The addon's `after` strokes fitted to `target` (the bounds of the drawing that matched):
 * stretched as `before` would have to be stretched to cover it. Line widths grow with the
 * height for a highlighter (a mark covers what is between), and with the overall size otherwise.
 */
export function fitAfter(settings: GestureSettings, target: Rect): GestureStroke[] {
  const from = drawingBounds(settings.before.map((s) => s.points))
  if (!from) return []
  const fw = from.maxX - from.minX
  const fh = from.maxY - from.minY
  const tw = target.maxX - target.minX
  const th = target.maxY - target.minY
  // A drawing that is a line (no height or width) keeps its proportions along it.
  const sx = fw > 1 ? tw / fw : fh > 1 ? th / fh : 1
  const sy = fh > 1 ? th / fh : sx
  return settings.after.map((s) => {
    const points: number[] = []
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      points.push(
        target.minX + (s.points[i]! - from.minX) * sx,
        target.minY + (s.points[i + 1]! - from.minY) * sy,
      )
    }
    const k = s.tool === 'highlighter' ? sy : Math.sqrt(Math.abs(sx * sy))
    return { ...s, points, width: Math.max(0.5, s.width * k) }
  })
}

interface P {
  x: number
  y: number
}

/** Resampled to evenly spaced points and stretched to the unit square. */
function normalize(drawing: Drawing): P[] | null {
  const strokes = drawing.map((pts) => {
    const out: P[] = []
    for (let i = 0; i + 1 < pts.length; i += 2) out.push({ x: pts[i]!, y: pts[i + 1]! })
    return out
  })
  const all = resample(strokes, SAMPLES)
  if (all.length === 0) return null
  const b = drawingBounds([all.flatMap((p) => [p.x, p.y])])!
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const big = Math.max(w, h)
  if (big <= 0) return null
  // Each axis on its own, unless the drawing is nearly a line along one of them.
  const sx = w > big * 0.05 ? w : big
  const sy = h > big * 0.05 ? h : big
  return all.map((p) => ({ x: (p.x - b.minX) / sx, y: (p.y - b.minY) / sy }))
}

function resample(strokes: P[][], n: number): P[] {
  let length = 0
  for (const s of strokes) for (let i = 1; i < s.length; i++) length += dist(s[i - 1]!, s[i]!)
  const out: P[] = []
  if (length <= 0) {
    const p = strokes.find((s) => s.length)?.[0]
    if (p) for (let i = 0; i < n; i++) out.push(p)
    return out
  }
  const step = length / (n - 1)
  let carry = 0
  for (const s of strokes) {
    if (s.length === 0) continue
    out.push(s[0]!)
    carry = 0
    for (let i = 1; i < s.length; i++) {
      let a = s[i - 1]!
      const b = s[i]!
      let d = dist(a, b)
      while (carry + d >= step && out.length < n) {
        const t = (step - carry) / d
        const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
        out.push(q)
        a = q
        d = dist(a, b)
        carry = 0
      }
      carry += d
    }
  }
  while (out.length < n) out.push(out[out.length - 1]!)
  return out.slice(0, n)
}

/** Greedy cloud matching ($P): each point of `a` to the nearest unused point of `b`. */
function cloudDistance(a: P[], b: P[], start: number): number {
  const n = a.length
  const used = new Array<boolean>(n).fill(false)
  let sum = 0
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n
    let best = Infinity
    let index = -1
    for (let j = 0; j < n; j++) {
      if (used[j]) continue
      const d = dist(a[i]!, b[j]!)
      if (d < best) {
        best = d
        index = j
      }
    }
    used[index] = true
    // Earlier matches are more reliable than the last few leftovers.
    sum += (1 - k / n) * best
  }
  // The weights add up to about half the points.
  return sum * 2
}

function dist(a: P, b: P): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
