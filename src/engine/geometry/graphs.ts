import type { DrawnStroke } from './arrows.ts'
import { headAt } from './arrows.ts'
import { boundsOfPoints } from './rect.ts'
import { simplify, toPts } from './shapes.ts'

/**
 * Hand-drawn graph axes: a horizontal and a vertical line (an "L", drawn in one stroke or two,
 * or a cross of two strokes), maybe a third, slanted one through their crossing, and an arrow
 * head drawn at the end of one of them. The clean
 * version has straight axes that meet where they were drawn to meet, and arrow heads at the
 * right end of the horizontal axis and the top end of the vertical one, never left or bottom.
 */

type Pt = { x: number; y: number }

export interface CleanGraph {
  /** The strokes the axes were drawn with, the head last. */
  ids: string[]
  /** Horizontal axis, vertical axis, their heads (right, top), then a slanted axis and its head. */
  lines: number[][]
}

/** Lines this close to level or upright (in degrees) count as axes. */
const AXIS_TILT = 20
const HEAD_ANGLE_MIN = 25
const HEAD_ANGLE_MAX = 140

function len(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** An arrow head drawn on its own: a "V" or ">" with arms of similar length. */
function headOf(points: readonly number[]): { tip: Pt; dir: Pt; size: number } | null {
  const pts = toPts(points)
  if (pts.length < 3) return null
  const b = boundsOfPoints(points)
  const size = Math.hypot(b.maxX - b.minX, b.maxY - b.minY)
  if (size < 4) return null
  const a = pts[0]!
  const c = pts[pts.length - 1]!
  // The apex is the point furthest from the line between the arm ends.
  let apex = pts[0]!
  let far = -1
  for (const p of pts) {
    const d = len(a, p) + len(p, c)
    if (d > far) {
      far = d
      apex = p
    }
  }
  const la = len(apex, a)
  const lc = len(apex, c)
  if (Math.min(la, lc) < Math.max(la, lc) * 0.35 || Math.min(la, lc) < 2) return null
  // Both arms are fairly straight.
  const line = simplify(pts, Math.max(0.8, size * 0.12))
  if (line.length > 4) return null
  const ua = { x: (a.x - apex.x) / la, y: (a.y - apex.y) / la }
  const uc = { x: (c.x - apex.x) / lc, y: (c.y - apex.y) / lc }
  const open = (Math.acos(Math.max(-1, Math.min(1, ua.x * uc.x + ua.y * uc.y))) * 180) / Math.PI
  if (open < HEAD_ANGLE_MIN || open > HEAD_ANGLE_MAX) return null
  const bx = ua.x + uc.x
  const by = ua.y + uc.y
  const bl = Math.hypot(bx, by)
  if (bl < 1e-6) return null
  return { tip: apex, dir: { x: -bx / bl, y: -by / bl }, size: (la + lc) / 2 }
}

interface Axis {
  /** Level: y and the x range; upright: x and the y range. */
  at: number
  from: number
  to: number
  length: number
}

/**
 * The level and upright stretches of the axis strokes, and a third, slanted axis when one
 * straight stroke runs diagonally; null when anything else is there.
 */
function axesOf(strokes: readonly DrawnStroke[]): { h: Axis; v: Axis; d: [Pt, Pt] | null } | null {
  const hs: [Pt, Pt, number][] = []
  const vs: [Pt, Pt, number][] = []
  let d: [Pt, Pt] | null = null
  let total = 0
  let used = 0
  for (const s of strokes) {
    const pts = toPts(s.points)
    const b = boundsOfPoints(s.points)
    const size = Math.hypot(b.maxX - b.minX, b.maxY - b.minY)
    const line = simplify(pts, Math.max(2, size * 0.06))
    const first = pts[0]!
    const last = pts[pts.length - 1]!
    const tilt =
      (Math.atan2(Math.abs(last.y - first.y), Math.abs(last.x - first.x)) * 180) / Math.PI
    // One straight, slanted stroke is a third axis (depth, as in 3D drawings).
    if (line.length === 2 && tilt >= AXIS_TILT && tilt <= 90 - AXIS_TILT) {
      if (d) return null
      d = [first, last]
      continue
    }
    for (let i = 1; i < line.length; i++) {
      const p = line[i - 1]!
      const q = line[i]!
      const l = len(p, q)
      total += l
      const tilt = (Math.atan2(Math.abs(q.y - p.y), Math.abs(q.x - p.x)) * 180) / Math.PI
      if (tilt < AXIS_TILT) {
        hs.push([p, q, l])
        used += l
      } else if (tilt > 90 - AXIS_TILT) {
        vs.push([p, q, l])
        used += l
      }
    }
  }
  if (!hs.length || !vs.length || used < total * 0.88) return null
  const axis = (segs: [Pt, Pt, number][], level: boolean): Axis => {
    let at = 0
    let length = 0
    let from = Infinity
    let to = -Infinity
    for (const [p, q, l] of segs) {
      at += ((level ? p.y + q.y : p.x + q.x) / 2) * l
      length += l
      from = Math.min(from, level ? p.x : p.y, level ? q.x : q.y)
      to = Math.max(to, level ? p.x : p.y, level ? q.x : q.y)
    }
    return { at: at / length, from, to, length: to - from }
  }
  return { h: axis(hs, true), v: axis(vs, false), d }
}

/**
 * Finds graph axes in strokes drawn one after another, the last being an arrow head at the end
 * of one axis. Returns null when they do not form one.
 */
export function detectGraph(strokes: readonly DrawnStroke[]): CleanGraph | null {
  if (strokes.length < 2 || strokes.length > 4) return null
  const head = headOf(strokes[strokes.length - 1]!.points)
  if (!head) return null
  const axes = axesOf(strokes.slice(0, -1))
  if (!axes) return null
  const { h, v, d } = axes
  const longest = Math.max(h.length, v.length)
  if (Math.min(h.length, v.length) < Math.max(head.size * 1.5, longest * 0.15)) return null
  const reach = Math.max(6, longest * 0.12)
  // The axes cross or meet.
  if (v.at < h.from - reach || v.at > h.to + reach) return null
  if (h.at < v.from - reach || h.at > v.to + reach) return null
  // A slanted axis runs through where the others cross; its head goes on its upper end.
  let slant: { from: Pt; to: Pt; dir: Pt } | null = null
  if (d) {
    const [a, c] = d
    const l = len(a, c)
    const cross = (v.at - a.x) * (c.y - a.y) - (h.at - a.y) * (c.x - a.x)
    if (l < longest * 0.3 || Math.abs(cross) / l > reach) return null
    const up = a.y < c.y || (a.y === c.y && a.x > c.x) ? a : c
    const down = up === a ? c : a
    slant = { from: down, to: up, dir: { x: (up.x - down.x) / l, y: (up.y - down.y) / l } }
  }
  // The head sits at an axis end and points outwards along it.
  const ends = [
    { p: { x: h.from, y: h.at }, d: { x: -1, y: 0 } },
    { p: { x: h.to, y: h.at }, d: { x: 1, y: 0 } },
    { p: { x: v.at, y: v.from }, d: { x: 0, y: -1 } },
    { p: { x: v.at, y: v.to }, d: { x: 0, y: 1 } },
    ...(slant
      ? [
          { p: slant.to, d: slant.dir },
          { p: slant.from, d: { x: -slant.dir.x, y: -slant.dir.y } },
        ]
      : []),
  ]
  const near = Math.max(reach, head.size * 1.2)
  const atEnd = ends.some(
    (e) =>
      len(e.p, head.tip) < near && e.d.x * head.dir.x + e.d.y * head.dir.y > Math.cos(Math.PI / 4),
  )
  if (!atEnd) return null

  // Ends close to the other axis meet it exactly (the corner of an "L").
  const snap = (value: number, to: number) => (Math.abs(value - to) < reach ? to : value)
  const left = snap(h.from, v.at)
  const right = Math.max(snap(h.to, v.at), left + 1)
  const top = snap(v.from, h.at)
  const bottom = Math.max(snap(v.to, h.at), top + 1)
  const size = Math.min(Math.max(3, head.size), longest * 0.25)
  return {
    ids: strokes.map((s) => s.id),
    lines: [
      [left, h.at, right, h.at],
      [v.at, bottom, v.at, top],
      headAt({ x: right, y: h.at }, { x: 1, y: 0 }, size),
      headAt({ x: v.at, y: top }, { x: 0, y: -1 }, size),
      ...(slant
        ? [[slant.from.x, slant.from.y, slant.to.x, slant.to.y], headAt(slant.to, slant.dir, size)]
        : []),
    ],
  }
}
