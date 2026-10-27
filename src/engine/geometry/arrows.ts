import { perfectLine } from './perfect.ts'
import { boundsOfPoints } from './rect.ts'
import { simplify, toPts } from './shapes.ts'

/**
 * Hand-drawn arrows: a shaft (straight or bent) with two barbs at its tip, drawn in one stroke
 * or several (a line, then a "V" or ">" for the head), at any size. A clean arrow keeps the
 * shaft (straight when it nearly is, otherwise smoothed with its corners) and gets an even head
 * pointing along the shaft's end.
 */

export interface DrawnStroke {
  id: string
  points: readonly number[]
}

export interface CleanArrow {
  /** The strokes the arrow was drawn with. */
  ids: string[]
  shaft: number[]
  /** The shaft's points are joined by straight segments (always, once it is clean). */
  straight: boolean
  head: number[]
}

type Pt = { x: number; y: number }

/** Barbs this far from the shaft direction (in degrees) count as an arrow head. */
const MIN_BARB_ANGLE = 5
const MAX_BARB_ANGLE = 80
/** The two barbs together open at least this far (in degrees). */
const MIN_HEAD_OPEN = 25
/** Smaller drawings (their diagonal, in points) are dots or writing. */
const MIN_SIZE = 6
/** The head opens this far on each side, in degrees. */
const HEAD_ANGLE = 28

interface Arm {
  /** The stroke it belongs to. */
  stroke: number
  /** Where it starts (near the tip) and its direction away from the tip. */
  from: Pt
  dx: number
  dy: number
  length: number
}

function length(points: readonly number[]): number {
  let l = 0
  for (let i = 2; i < points.length; i += 2) {
    l += Math.hypot(points[i]! - points[i - 2]!, points[i + 1]! - points[i - 1]!)
  }
  return l
}

/** Angle between two unit directions, in degrees. */
function angle(ax: number, ay: number, bx: number, by: number): number {
  return (Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by))) * 180) / Math.PI
}

/**
 * Finds an arrow in strokes drawn close together (the shaft is the longest). Returns null when
 * they do not form one.
 */
export function detectArrow(strokes: readonly DrawnStroke[]): CleanArrow | null {
  if (!strokes.length || strokes.length > 3) return null
  const lengths = strokes.map((s) => length(s.points))
  const shaftIndex = lengths.indexOf(Math.max(...lengths))
  const shaftStroke = strokes[shaftIndex]!
  const b = boundsOfPoints(strokes.flatMap((s) => s.points))
  const size = Math.hypot(b.maxX - b.minX, b.maxY - b.minY)
  if (size < MIN_SIZE) return null
  const eps = Math.max(0.6, size * 0.035)
  const reach = Math.max(2.5, size * 0.09)

  // Every straight piece of every stroke, as a possible barb or the end of the shaft.
  // Each stroke is simplified at its own scale: a small head next to a long shaft keeps its "V".
  const polylines = strokes.map((s) => {
    const sb = boundsOfPoints(s.points)
    const own = Math.hypot(sb.maxX - sb.minX, sb.maxY - sb.minY)
    return simplify(toPts(s.points), Math.min(eps, Math.max(0.6, own * 0.06)))
  })
  const tips: { p: Pt; stroke: number; vertex: number }[] = []
  polylines.forEach((line, si) => line.forEach((p, vi) => tips.push({ p, stroke: si, vertex: vi })))

  let best: { arrow: CleanArrow; score: number } | null = null
  for (const tip of tips) {
    // The shaft runs to the tip from its far end: drawn towards the tip or away from it.
    const toTip = shaftTo(shaftStroke.points, tip.p, reach * 0.7, size * 0.45)
    if (!toTip) continue
    const shaftLength = length(toTip)
    if (shaftLength < size * 0.45) continue
    const end = { x: toTip[toTip.length - 2]!, y: toTip[toTip.length - 1]! }
    if (Math.hypot(end.x - tip.p.x, end.y - tip.p.y) > reach) continue
    // Direction the shaft points at the tip, from a stretch before it.
    const back = pointBefore(toTip, Math.min(shaftLength * 0.25, Math.max(3, size * 0.12)))
    const sl = Math.hypot(end.x - back.x, end.y - back.y)
    if (sl < 1e-6) continue
    const ux = (end.x - back.x) / sl
    const uy = (end.y - back.y) / sl

    // Arms that leave the tip backwards, to either side of the shaft.
    const arms: Arm[] = []
    polylines.forEach((line, si) => {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i]!
        const c = line[i + 1]!
        for (const [from, to] of [
          [a, c],
          [c, a],
        ] as const) {
          if (Math.hypot(from.x - tip.p.x, from.y - tip.p.y) > reach) continue
          const l = Math.hypot(to.x - from.x, to.y - from.y)
          if (l < Math.max(1.5, shaftLength * 0.015) || l > shaftLength * 0.7) continue
          // A piece that runs along the shaft is the shaft itself, not a barb.
          if (distanceToLine(to, toTip) < Math.max(1, l * 0.12)) continue
          arms.push({
            stroke: si,
            from,
            dx: (to.x - from.x) / l,
            dy: (to.y - from.y) / l,
            length: l,
          })
        }
      }
    })
    const left: Arm[] = []
    const right: Arm[] = []
    for (const arm of arms) {
      const a = angle(arm.dx, arm.dy, -ux, -uy)
      if (a < MIN_BARB_ANGLE || a > MAX_BARB_ANGLE) continue
      const side = ux * arm.dy - uy * arm.dx
      ;(side > 0 ? left : right).push(arm)
    }
    if (!left.length || !right.length) continue
    const l = left.reduce((m, a) => (a.length > m.length ? a : m))
    const r = right.reduce((m, a) => (a.length > m.length ? a : m))
    if (angle(l.dx, l.dy, r.dx, r.dy) < MIN_HEAD_OPEN) continue
    // Barbs of very different sizes are more likely writing than a head.
    if (Math.min(l.length, r.length) < Math.max(l.length, r.length) * 0.3) continue
    const used = new Set([shaftIndex, l.stroke, r.stroke])
    // Every stroke in the group must be part of the arrow.
    if (used.size !== strokes.length) continue
    const headLength = Math.min(
      Math.max(3, (l.length + r.length) / 2),
      Math.max(3, shaftLength * 0.35),
    )
    const score = l.length + r.length
    if (best && best.score >= score) continue
    const straightness = maxDeviation(toTip)
    const straight = straightness < Math.max(1.5, shaftLength * 0.06)
    const start = { x: toTip[0]!, y: toTip[1]! }
    const shaft = straight ? [start.x, start.y, end.x, end.y] : perfectLine(toTip)
    const n = shaft.length
    const tipAt = { x: shaft[n - 2]!, y: shaft[n - 1]! }
    const from = straight ? start : pointBefore(shaft, Math.min(headLength, shaftLength * 0.2))
    const fl = Math.hypot(tipAt.x - from.x, tipAt.y - from.y)
    const dir =
      fl > 1e-6 ? { x: (tipAt.x - from.x) / fl, y: (tipAt.y - from.y) / fl } : { x: ux, y: uy }
    best = {
      arrow: {
        ids: strokes.map((s) => s.id),
        shaft,
        straight: true,
        head: headAt(tipAt, dir, headLength),
      },
      score,
    }
  }
  return best?.arrow ?? null
}

/**
 * The part of a stroke from one end up to where it first comes near `tip` after at least
 * `minLength` of line, from whichever end gives the longer shaft.
 */
function shaftTo(points: readonly number[], tip: Pt, near: number, minLength: number) {
  let best: number[] | null = null
  for (const line of [points, reverse(points)]) {
    let travelled = 0
    for (let i = 1; i < line.length / 2; i++) {
      travelled += Math.hypot(line[i * 2]! - line[i * 2 - 2]!, line[i * 2 + 1]! - line[i * 2 - 1]!)
      if (travelled < minLength) continue
      if (Math.hypot(line[i * 2]! - tip.x, line[i * 2 + 1]! - tip.y) > near) continue
      // Run on to the point closest to the tip, so the shaft reaches it.
      let end = i
      let closest = Infinity
      for (let j = i; j < line.length / 2; j++) {
        const d = Math.hypot(line[j * 2]! - tip.x, line[j * 2 + 1]! - tip.y)
        if (d > near) break
        if (d < closest) {
          closest = d
          end = j
        }
      }
      const piece = line.slice(0, end * 2 + 2)
      if (!best || travelled > length(best)) best = piece
      break
    }
  }
  return best
}

function reverse(points: readonly number[]): number[] {
  const out: number[] = []
  for (let i = points.length - 2; i >= 0; i -= 2) out.push(points[i]!, points[i + 1]!)
  return out
}

/** How far a point is from a polyline. */
function distanceToLine(p: Pt, points: readonly number[]): number {
  let best = Infinity
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i]!
    const ay = points[i + 1]!
    const bx = points[i + 2]!
    const by = points[i + 3]!
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(p.x - ax - dx * t, p.y - ay - dy * t))
  }
  return best
}

/** The point `distance` before the end of a polyline. */
function pointBefore(points: readonly number[], distance: number): Pt {
  let left = distance
  for (let i = points.length - 4; i >= 0; i -= 2) {
    const d = Math.hypot(points[i]! - points[i + 2]!, points[i + 1]! - points[i + 3]!)
    if (d >= left) {
      const t = left / d
      return {
        x: points[i + 2]! + (points[i]! - points[i + 2]!) * t,
        y: points[i + 3]! + (points[i + 1]! - points[i + 3]!) * t,
      }
    }
    left -= d
  }
  return { x: points[0]!, y: points[1]! }
}

/** How far a polyline strays from the line between its ends. */
function maxDeviation(points: readonly number[]): number {
  const ax = points[0]!
  const ay = points[1]!
  const bx = points[points.length - 2]!
  const by = points[points.length - 1]!
  const l = Math.hypot(bx - ax, by - ay) || 1
  let max = 0
  for (let i = 0; i < points.length; i += 2) {
    max = Math.max(
      max,
      Math.abs((bx - ax) * (ay - points[i + 1]!) - (ax - points[i]!) * (by - ay)) / l,
    )
  }
  return max
}

/** An even head at `tip` for a shaft pointing in `dir`: barb, tip, barb. */
export function headAt(tip: Pt, dir: Pt, size: number): number[] {
  const a = (HEAD_ANGLE * Math.PI) / 180
  const bx = -dir.x
  const by = -dir.y
  const rot = (s: number) => ({
    x: tip.x + size * (bx * Math.cos(s) - by * Math.sin(s)),
    y: tip.y + size * (bx * Math.sin(s) + by * Math.cos(s)),
  })
  const l = rot(a)
  const r = rot(-a)
  return [l.x, l.y, tip.x, tip.y, r.x, r.y]
}
