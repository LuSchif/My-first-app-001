import { perfectLine } from './perfect.ts'
import { boundsOfPoints } from './rect.ts'
import { closedLoop, polygonArea, simplify, toPts } from './shapes.ts'

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
  /** The head is a closed triangle (drawn as one) rather than two barbs. */
  closedHead?: boolean
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
    const found = shaftTo(shaftStroke.points, tip.p, reach * 0.7, size * 0.45)
    if (!found) continue
    const { piece: toTip, rest } = found
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
          // In the shaft's own stroke, barbs can only come after the tip.
          if (si === shaftIndex && distanceToLine(to, rest) > 1) continue
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
    // What the shaft's stroke draws after the tip is the head and nothing more: a wave or
    // a word going on past a turn is no arrow.
    if (length(rest) > 2.6 * Math.max(l.length, r.length) + reach) continue
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
 * `minLength` of line, from whichever end gives the longer shaft, and what follows it.
 */
function shaftTo(
  points: readonly number[],
  tip: Pt,
  near: number,
  minLength: number,
): { piece: number[]; rest: number[] } | null {
  let best: { piece: number[]; rest: number[] } | null = null
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
      if (!best || travelled > length(best.piece)) best = { piece, rest: line.slice(end * 2) }
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

/**
 * An arrow whose head is drawn as a triangle: a separate triangle at the shaft's end, or one
 * drawn on from the shaft in the same stroke. The clean arrow keeps the drawn head's size and
 * proportions, made symmetric, pointing where the drawn one points.
 */
export function detectTriangleArrow(strokes: readonly DrawnStroke[]): CleanArrow | null {
  if (!strokes.length || strokes.length > 2) return null
  let shaft: Pt[]
  let loop: Pt[] | null
  if (strokes.length === 2) {
    const [a, b] = strokes
    const shaftStroke = length(a!.points) >= length(b!.points) ? a! : b!
    const headStroke = shaftStroke === a ? b! : a!
    shaft = toPts(shaftStroke.points)
    loop = closedLoop(headStroke.points)
  } else {
    const split = loopAtEnd(toPts(strokes[0]!.points))
    if (!split) return null
    shaft = split.shaft
    loop = split.loop
  }
  if (!loop || loop.length < 4 || shaft.length < 2) return null
  const tri = triangleOf(loop)
  if (!tri) return null
  const start = shaft[0]!
  // The tip is the corner furthest from where the shaft starts.
  const order = [...tri].sort(
    (p, q) => Math.hypot(q.x - start.x, q.y - start.y) - Math.hypot(p.x - start.x, p.y - start.y),
  )
  const tip = order[0]!
  const b1 = order[1]!
  const b2 = order[2]!
  const base = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 }
  const headLength = Math.hypot(tip.x - base.x, tip.y - base.y)
  if (headLength < 2) return null
  const dir = { x: (tip.x - base.x) / headLength, y: (tip.y - base.y) / headLength }
  // The shaft up to the head, without what was drawn inside it.
  const inside = (p: Pt) => pointInTriangle(p, tri)
  let end = shaft.length
  while (end > 1 && inside(shaft[end - 1]!)) end--
  const body = shaft.slice(0, end)
  const last = body[body.length - 1]!
  const shaftLength =
    length(body.flatMap((p) => [p.x, p.y])) + Math.hypot(base.x - last.x, base.y - last.y)
  if (shaftLength < headLength * 1.5) return null
  // The shaft must come to the head's base, and arrive roughly in the head's direction.
  const triSize = Math.max(...tri.map((p) => Math.hypot(p.x - base.x, p.y - base.y)))
  if (Math.hypot(last.x - base.x, last.y - base.y) > triSize * 1.3 + 4) return null
  const before = pointBefore(
    body.flatMap((p) => [p.x, p.y]),
    Math.min(shaftLength * 0.25, Math.max(6, headLength * 2)),
  )
  const sl = Math.hypot(base.x - before.x, base.y - before.y)
  if (sl > 1e-6 && ((base.x - before.x) * dir.x + (base.y - before.y) * dir.y) / sl < 0.5) {
    return null
  }
  const drawn = [...body.flatMap((p) => [p.x, p.y]), base.x, base.y]
  const straight = maxDeviation(drawn) < Math.max(1.5, shaftLength * 0.06)
  const cleanShaft = straight ? [start.x, start.y, base.x, base.y] : perfectLine(drawn)
  // A symmetric head as wide as the drawn one.
  const halfBase = Math.hypot(b1.x - b2.x, b1.y - b2.y) / 2
  const n = { x: -dir.y, y: dir.x }
  return {
    ids: strokes.map((s) => s.id),
    shaft: cleanShaft,
    straight: true,
    head: [
      tip.x,
      tip.y,
      base.x + n.x * halfBase,
      base.y + n.y * halfBase,
      base.x - n.x * halfBase,
      base.y - n.y * halfBase,
    ],
    closedHead: true,
  }
}

/**
 * A stroke that ends by drawing a small closed loop (a triangle head drawn on from the shaft):
 * the shaft before it and the loop. The loop is found where the end of the stroke crosses or
 * comes back to an earlier point, and must be a small part of the stroke.
 */
function loopAtEnd(pts: Pt[]): { shaft: Pt[]; loop: Pt[] } | null {
  const n = pts.length
  if (n < 8) return null
  const total = length(pts.flatMap((p) => [p.x, p.y]))
  const cum = [0]
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
  const minFrom = cum.findIndex((c) => c >= total * 0.45)
  // The stroke's end comes back to (or crosses) an earlier point.
  const e = pts[n - 1]!
  let best: { at: number; hit: Pt } | null = null
  for (let i = Math.max(0, minFrom); i < n - 3; i++) {
    const p = pts[i]!
    const q = pts[i + 1]!
    const perimeter = total - cum[i]!
    if (perimeter < 6) break
    const near = Math.max(2, perimeter * 0.08)
    // Only the last part of the loop can close it: earlier crossings are bends of the shaft.
    for (let j = n - 2; j > i + 2 && cum[j]! >= total - perimeter * 0.3; j--) {
      const hit = crossing(p, q, pts[j]!, pts[j + 1]!)
      if (hit) {
        best = { at: i, hit }
        break
      }
    }
    if (best) break
    if (Math.hypot(e.x - p.x, e.y - p.y) < near) {
      best = { at: i, hit: p }
      break
    }
  }
  if (!best) return null
  const shaft = [...pts.slice(0, best.at + 1), best.hit]
  const loop = [best.hit, ...pts.slice(best.at + 1)]
  if (length(loop.flatMap((p) => [p.x, p.y])) > total * 0.5) return null
  return { shaft, loop }
}

function crossing(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * The three corners of a loop that is a triangle: the largest triangle inside it must cover
 * most of it (a circle or a square covers much less).
 */
function triangleOf(loop: Pt[]): [Pt, Pt, Pt] | null {
  // The largest triangle between points of the loop (every few points is enough).
  const every = Math.max(1, Math.floor(loop.length / 40))
  const pts = loop.filter((_, i) => i % every === 0)
  let best: [Pt, Pt, Pt] | null = null
  let bestArea = 0
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      for (let k = j + 1; k < pts.length; k++) {
        const a = pts[i]!
        const b = pts[j]!
        const c = pts[k]!
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2
        if (area > bestArea) {
          bestArea = area
          best = [a, b, c]
        }
      }
    }
  }
  if (!best || bestArea < 2) return null
  const area = Math.abs(polygonArea(loop))
  return area > 1e-6 && bestArea / area >= 0.7 ? best : null
}

function pointInTriangle(p: Pt, [a, b, c]: [Pt, Pt, Pt]): boolean {
  const s = (u: Pt, v: Pt) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x)
  const d1 = s(a, b)
  const d2 = s(b, c)
  const d3 = s(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
