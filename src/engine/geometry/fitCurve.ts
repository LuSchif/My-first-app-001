import { catmullRomControls } from './strokePath.ts'

/**
 * Turns a drawn polyline into a vector path, like in an illustration app: few anchor points on
 * the line, smooth curves between them, and sharp corners kept where the pen changed direction
 * abruptly. Between corners the curve is a centripetal Catmull-Rom spline through the anchors,
 * so the bend flows evenly from one segment into the next. Anchors are added where the curve
 * strays more than the tolerance from the drawn points.
 *
 * A path is a flat list: the start point, then six numbers per segment (two control points and
 * the end point): x0, y0, c1x, c1y, c2x, c2y, x1, y1, …
 */

type Vec = { x: number; y: number }

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y })
const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s })
const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y
const len = (a: Vec): number => Math.hypot(a.x, a.y)
const norm = (a: Vec): Vec => {
  const l = len(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

/** How far apart corner tests look along the line, in points. */
const CORNER_REACH = 3
/** A turn sharper than this (radians) is a corner, not a curve. */
const CORNER_ANGLE = (75 * Math.PI) / 180

export interface FitOptions {
  /** Largest allowed distance between the path and the drawn points, in points. */
  tolerance?: number
}

export function fitPath(flat: readonly number[], options: FitOptions = {}): number[] {
  const tolerance = options.tolerance ?? 0.5
  const pts = dedupe(flat)
  if (pts.length === 0) return []
  if (pts.length === 1) return [pts[0]!.x, pts[0]!.y]
  if (pts.length === 2) return lineSegment(pts[0]!, pts[1]!)

  const corners = findCorners(pts)
  const out: number[] = [pts[0]!.x, pts[0]!.y]
  for (let c = 0; c + 1 < corners.length; c++) {
    const first = corners[c]!
    const last = corners[c + 1]!
    const anchors = fitPiece(pts, first, last, tolerance)
    for (let j = 0; j + 1 < anchors.length; j++) out.push(...splineSegment(pts, anchors, j))
  }
  return out
}

/** Anchor indices for the stretch between two corners, refined until the curve fits. */
function fitPiece(pts: Vec[], first: number, last: number, tolerance: number): number[] {
  const anchors = [first, last]
  for (let round = 0; round < 64; round++) {
    let added = false
    // Every segment that strays too far from the drawn points is split.
    const next: number[] = [anchors[0]!]
    for (let j = 0; j + 1 < anchors.length; j++) {
      const a = anchors[j]!
      const b = anchors[j + 1]!
      if (b - a > 1) {
        const seg = splineSegment(pts, anchors, j)
        const curve = sampleSegment(pts[a]!, seg, 24)
        let strays = false
        for (let i = a + 1; i < b && !strays; i++) {
          strays = distanceToPolyline(pts[i]!, curve) > tolerance
        }
        // Halving by length keeps anchors evenly spread, which the spline likes best.
        if (strays) {
          next.push(middleByLength(pts, a, b))
          added = true
        }
      }
      next.push(b)
    }
    anchors.splice(0, anchors.length, ...next)
    if (!added) break
  }
  // Refining adds anchors greedily; drop the ones the curve fits without.
  for (let j = 1; j < anchors.length - 1; j++) {
    const without = [...anchors.slice(0, j), ...anchors.slice(j + 1)]
    if (fits(pts, without, Math.max(0, j - 2), Math.min(without.length - 1, j + 1), tolerance)) {
      anchors.splice(j, 1)
      j--
    }
  }
  return anchors
}

/** The point halfway along the drawn line between a and b. */
function middleByLength(pts: Vec[], a: number, b: number): number {
  let total = 0
  for (let i = a; i < b; i++) total += len(sub(pts[i + 1]!, pts[i]!))
  let d = 0
  for (let i = a; i < b; i++) {
    d += len(sub(pts[i + 1]!, pts[i]!))
    if (d >= total / 2) return Math.min(b - 1, Math.max(a + 1, i + 1))
  }
  return a + 1
}

/** Whether segments from..to-1 of the spline stay within the tolerance of the drawn points. */
function fits(pts: Vec[], anchors: number[], from: number, to: number, tolerance: number) {
  for (let j = from; j < to; j++) {
    const a = anchors[j]!
    const b = anchors[j + 1]!
    const curve = sampleSegment(pts[a]!, splineSegment(pts, anchors, j), 24)
    for (let i = a + 1; i < b; i++) if (distanceToPolyline(pts[i]!, curve) > tolerance) return false
  }
  return true
}

/**
 * Control points and end of segment j of the Catmull-Rom spline through the anchors. Beyond the
 * first and last anchor, a mirrored point continues the drawn line's own direction.
 */
function splineSegment(pts: Vec[], anchors: number[], j: number): number[] {
  const n = anchors.length
  const at = (k: number): Vec => {
    if (k < 0) return mirror(pts, anchors[0]!, anchors[1]!, 1)
    if (k >= n) return mirror(pts, anchors[n - 1]!, anchors[n - 2]!, -1)
    return pts[anchors[k]!]!
  }
  const p0 = at(j - 1)
  const p1 = at(j)
  const p2 = at(j + 1)
  const p3 = at(j + 2)
  const [c1x, c1y, c2x, c2y] = catmullRomControls(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  return [c1x, c1y, c2x, c2y, p2.x, p2.y]
}

/**
 * A point behind an end anchor: the next anchor mirrored across the line's normal at the end,
 * so the curve continues as it bends there, in the direction the drawn line leaves the end.
 */
function mirror(pts: Vec[], end: number, neighbour: number, dir: 1 | -1): Vec {
  const j = walk(pts, end, dir, CORNER_REACH * 2, 0, pts.length - 1)
  const p = pts[end]!
  const t = norm(sub(pts[j === end ? neighbour : j]!, p))
  const v = sub(pts[neighbour]!, p)
  return add(p, sub(v, scale(t, 2 * dot(v, t))))
}

function sampleSegment(start: Vec, seg: number[], n: number): Vec[] {
  const b: Vec[] = [
    start,
    { x: seg[0]!, y: seg[1]! },
    { x: seg[2]!, y: seg[3]! },
    { x: seg[4]!, y: seg[5]! },
  ]
  return Array.from({ length: n + 1 }, (_, k) => bezierAt(b, k / n))
}

function distanceToPolyline(p: Vec, line: Vec[]): number {
  let best = Infinity
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!
    const d = sub(line[k + 1]!, a)
    const l2 = dot(d, d)
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / l2))
    best = Math.min(best, len(sub(p, add(a, scale(d, t)))))
  }
  return best
}

/** Points along a path, about `step` apart, for hit testing and erasing. */
export function samplePath(path: readonly number[], step = 1.5): number[] {
  if (path.length < 2) return []
  const out = [path[0]!, path[1]!]
  for (let i = 2; i + 5 < path.length; i += 6) {
    const p0 = { x: path[i - 2]!, y: path[i - 1]! }
    const p1 = { x: path[i]!, y: path[i + 1]! }
    const p2 = { x: path[i + 2]!, y: path[i + 3]! }
    const p3 = { x: path[i + 4]!, y: path[i + 5]! }
    const rough = len(sub(p1, p0)) + len(sub(p2, p1)) + len(sub(p3, p2))
    const n = Math.max(1, Math.ceil(rough / step))
    for (let k = 1; k <= n; k++) {
      const p = bezierAt([p0, p1, p2, p3], k / n)
      out.push(p.x, p.y)
    }
  }
  return out
}

function lineSegment(a: Vec, b: Vec): number[] {
  const d = sub(b, a)
  return [
    a.x,
    a.y,
    a.x + d.x / 3,
    a.y + d.y / 3,
    a.x + (d.x * 2) / 3,
    a.y + (d.y * 2) / 3,
    b.x,
    b.y,
  ]
}

function dedupe(flat: readonly number[]): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const p = { x: flat[i]!, y: flat[i + 1]! }
    const prev = out[out.length - 1]
    if (!prev || len(sub(p, prev)) > 1e-6) out.push(p)
  }
  return out
}

/** Index of the point about `reach` along the line from `i` in direction `dir`. */
function walk(pts: Vec[], i: number, dir: 1 | -1, reach: number, lo: number, hi: number): number {
  let j = i
  let d = 0
  while (j + dir >= lo && j + dir <= hi && d < reach) {
    d += len(sub(pts[j + dir]!, pts[j]!))
    j += dir
  }
  return j
}

/** Indices where the line turns sharply, plus both ends. */
function findCorners(pts: Vec[]): number[] {
  const last = pts.length - 1
  const corners = [0]
  let best = -1
  let bestTurn = 0
  for (let i = 1; i < last; i++) {
    const a = walk(pts, i, -1, CORNER_REACH, 0, last)
    const b = walk(pts, i, 1, CORNER_REACH, 0, last)
    const turn = Math.acos(
      Math.max(-1, Math.min(1, dot(norm(sub(pts[i]!, pts[a]!)), norm(sub(pts[b]!, pts[i]!))))),
    )
    if (turn > CORNER_ANGLE) {
      // Keep only the sharpest point of each bend.
      if (turn > bestTurn) {
        best = i
        bestTurn = turn
      }
    } else if (best >= 0) {
      corners.push(best)
      best = -1
      bestTurn = 0
    }
  }
  if (best >= 0) corners.push(best)
  if (corners[corners.length - 1] !== last) corners.push(last)
  return corners
}

function bezierAt(b: Vec[], t: number): Vec {
  const mt = 1 - t
  const a = mt * mt * mt
  const c1 = 3 * mt * mt * t
  const c2 = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * b[0]!.x + c1 * b[1]!.x + c2 * b[2]!.x + d * b[3]!.x,
    y: a * b[0]!.y + c1 * b[1]!.y + c2 * b[2]!.y + d * b[3]!.y,
  }
}
