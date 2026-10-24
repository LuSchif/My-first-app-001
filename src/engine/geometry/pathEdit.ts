/**
 * Editing a vector path (see fitCurve.ts for the layout): anchors with an incoming and an
 * outgoing handle each. Anchor 0 is at index 0; anchor i > 0 ends segment i - 1. A closed path
 * ends where it starts, so its first and last anchor move together.
 */
import { fitPath } from './fitCurve.ts'

export type HandleSide = 'in' | 'out'

export function anchorCount(path: readonly number[]): number {
  return path.length < 2 ? 0 : (path.length - 2) / 6 + 1
}

/** Index of anchor i's x coordinate. */
export function anchorIndex(i: number): number {
  return i === 0 ? 0 : 2 + 6 * (i - 1) + 4
}

/** Index of a handle's x coordinate, or -1 if the anchor has no handle on that side. */
export function handleIndex(path: readonly number[], i: number, side: HandleSide): number {
  const n = anchorCount(path)
  if (side === 'in') return i === 0 ? -1 : 2 + 6 * (i - 1) + 2
  return i >= n - 1 ? -1 : 2 + 6 * i
}

export function isClosedPath(path: readonly number[]): boolean {
  const n = path.length
  return n >= 8 && Math.hypot(path[0]! - path[n - 2]!, path[1]! - path[n - 1]!) < 1e-6
}

/** The anchors that share a position with anchor i (both ends of a closed path). */
function twins(path: readonly number[], i: number): number[] {
  const last = anchorCount(path) - 1
  if (!isClosedPath(path)) return [i]
  if (i === 0 || i === last) return [0, last]
  return [i]
}

/** Moves an anchor and its handles by (dx, dy). */
export function moveAnchor(path: readonly number[], i: number, dx: number, dy: number): number[] {
  // Straight segments next to the anchor stay straight lines when it moves.
  const straight = new Set<number>()
  for (const a of twins(path, i)) {
    for (const seg of [a - 1, a]) {
      if (seg >= 0 && seg < anchorCount(path) - 1 && isStraightSegment(path, seg)) straight.add(seg)
    }
  }
  const out = [...path]
  const touched = new Set<number>()
  for (const a of twins(path, i)) {
    for (const k of [anchorIndex(a), handleIndex(path, a, 'in'), handleIndex(path, a, 'out')]) {
      if (k < 0 || touched.has(k)) continue
      touched.add(k)
      out[k]! += dx
      out[k + 1]! += dy
    }
  }
  for (const seg of straight) straighten(out, seg)
  return out
}

/** Whether a segment's handles lie on the line between its anchors. */
export function isStraightSegment(path: readonly number[], seg: number): boolean {
  const i = 2 + 6 * seg
  const ax = path[i - 2]!
  const ay = path[i - 1]!
  const bx = path[i + 4]!
  const by = path[i + 5]!
  const length = Math.hypot(bx - ax, by - ay)
  if (length < 1e-6) return true
  const off = (x: number, y: number) =>
    Math.abs((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / length
  const tolerance = Math.max(0.3, length * 0.01)
  return off(path[i]!, path[i + 1]!) < tolerance && off(path[i + 2]!, path[i + 3]!) < tolerance
}

/** Puts a segment's handles a third of the way in from each end: a straight line. */
function straighten(path: number[], seg: number): void {
  const i = 2 + 6 * seg
  const ax = path[i - 2]!
  const ay = path[i - 1]!
  const bx = path[i + 4]!
  const by = path[i + 5]!
  path[i] = ax + (bx - ax) / 3
  path[i + 1] = ay + (by - ay) / 3
  path[i + 2] = ax + ((bx - ax) * 2) / 3
  path[i + 3] = ay + ((by - ay) * 2) / 3
}

/** The handle across the anchor from (i, side), joining the two ends of a closed path. */
function opposite(path: readonly number[], i: number, side: HandleSide): number {
  const other: HandleSide = side === 'in' ? 'out' : 'in'
  for (const a of twins(path, i)) {
    const k = handleIndex(path, a, other)
    if (k >= 0) return k
  }
  return -1
}

/** Whether the two handles of an anchor point in opposite directions (a smooth point). */
export function isSmooth(path: readonly number[], i: number): boolean {
  const a = anchorIndex(i)
  const hin =
    handleIndex(path, i, 'in') >= 0 ? handleIndex(path, i, 'in') : opposite(path, i, 'out')
  const hout = opposite(path, i, 'in')
  if (hin < 0 || hout < 0) return false
  const ux = path[hin]! - path[a]!
  const uy = path[hin + 1]! - path[a + 1]!
  const vx = path[hout]! - path[a]!
  const vy = path[hout + 1]! - path[a + 1]!
  const lu = Math.hypot(ux, uy)
  const lv = Math.hypot(vx, vy)
  if (lu < 1e-6 || lv < 1e-6) return false
  return (ux * vx + uy * vy) / (lu * lv) < -0.985
}

/**
 * Puts a handle at (x, y). On a smooth point the opposite handle turns with it, keeping its
 * length, so the curve stays smooth through the anchor.
 */
export function moveHandle(
  path: readonly number[],
  i: number,
  side: HandleSide,
  x: number,
  y: number,
  keepSmooth: boolean,
): number[] {
  const k = handleIndex(path, i, side)
  if (k < 0) return [...path]
  const out = [...path]
  out[k] = x
  out[k + 1] = y
  if (!keepSmooth) return out
  const o = opposite(path, i, side)
  if (o < 0) return out
  const a = anchorIndex(i)
  const ax = path[a]!
  const ay = path[a + 1]!
  const length = Math.hypot(path[o]! - ax, path[o + 1]! - ay)
  const dx = x - ax
  const dy = y - ay
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return out
  out[o] = ax - (dx / d) * length
  out[o + 1] = ay - (dy / d) * length
  return out
}

/** Removes an anchor; its two segments become one. Ends and tiny paths are kept as they are. */
export function deleteAnchor(path: readonly number[], i: number): number[] {
  const n = anchorCount(path)
  const closed = isClosedPath(path)
  if (n <= (closed ? 4 : 2)) return [...path]
  if (i === 0 || i === n - 1) {
    if (closed) {
      // The path now starts and ends at anchor 1; the segments around the old start merge.
      const m = n - 1
      const a1 = path.slice(anchorIndex(1), anchorIndex(1) + 2)
      const middle = path.slice(anchorIndex(1) + 2, anchorIndex(m - 1) + 2)
      const outPrev = path.slice(
        handleIndex(path, m - 1, 'out'),
        handleIndex(path, m - 1, 'out') + 2,
      )
      const in1 = path.slice(handleIndex(path, 1, 'in'), handleIndex(path, 1, 'in') + 2)
      return [...a1, ...middle, ...outPrev, ...in1, ...a1]
    }
    // An open end: the neighbouring anchor becomes the end.
    return i === 0 ? path.slice(anchorIndex(1)) : path.slice(0, anchorIndex(n - 2) + 2)
  }
  const hin = handleIndex(path, i, 'in')
  const out = [...path]
  // Segment i-1 keeps its first handle and takes the end of segment i.
  const merged = [
    path[hin - 2]!,
    path[hin - 1]!,
    path[hin + 6]!,
    path[hin + 7]!,
    path[hin + 8]!,
    path[hin + 9]!,
  ]
  out.splice(hin - 2, 12, ...merged)
  return out
}

/** The closest point on the path to (x, y): its segment, curve parameter and distance. */
export function nearestOnPath(
  path: readonly number[],
  x: number,
  y: number,
): { segment: number; t: number; distance: number } | null {
  let best: { segment: number; t: number; distance: number } | null = null
  for (let s = 0; s < anchorCount(path) - 1; s++) {
    const b = segment(path, s)
    for (let k = 0; k <= 40; k++) {
      const t = k / 40
      const p = bezier(b, t)
      const d = Math.hypot(p[0] - x, p[1] - y)
      if (!best || d < best.distance) best = { segment: s, t, distance: d }
    }
  }
  if (!best) return null
  // Refine around the best sample.
  const b = segment(path, best.segment)
  let step = 1 / 40
  for (let r = 0; r < 12; r++) {
    step /= 2
    const around: number[] = [best.t - step, best.t + step]
    for (const t of around) {
      if (t < 0 || t > 1) continue
      const p = bezier(b, t)
      const d = Math.hypot(p[0] - x, p[1] - y)
      if (d < best.distance) best = { ...best, t, distance: d }
    }
  }
  return best
}

/** Adds an anchor at parameter t of a segment without changing the curve's shape. */
export function insertAnchor(path: readonly number[], seg: number, t: number): number[] {
  const [p0, p1, p2, p3] = segment(path, seg) as [number[], number[], number[], number[]]
  const lerp = (a: number[], b: number[], u: number) => [
    a[0]! + (b[0]! - a[0]!) * u,
    a[1]! + (b[1]! - a[1]!) * u,
  ]
  const p01 = lerp(p0, p1, t)
  const p12 = lerp(p1, p2, t)
  const p23 = lerp(p2, p3, t)
  const p012 = lerp(p01, p12, t)
  const p123 = lerp(p12, p23, t)
  const mid = lerp(p012, p123, t)
  const start = 2 + 6 * seg
  const out = [...path]
  out.splice(start, 6, ...p01, ...p012, ...mid, ...p123, ...p23, ...p3)
  return out
}

/** A stroke's path for editing: its own, or one made from its points. */
export function editablePath(stroke: {
  points: readonly number[]
  path?: readonly number[]
  closed?: boolean
  straight?: boolean
}): number[] {
  if (stroke.path && stroke.path.length >= 8) return [...stroke.path]
  const pts = [...stroke.points]
  if (stroke.closed && pts.length >= 4) pts.push(pts[0]!, pts[1]!)
  // A line drawn (nearly) straight becomes one straight segment between its ends.
  if (!stroke.closed && nearlyStraight(pts)) {
    return straightPath([pts[0]!, pts[1]!, pts[pts.length - 2]!, pts[pts.length - 1]!])
  }
  if (stroke.straight) return straightPath(pts)
  // Few anchors, so editing stays simple; more can be added by tapping the line.
  return fitPath(pts, { tolerance: EDIT_TOLERANCE })
}

/** How loosely an editable path follows a drawn stroke, in points. */
const EDIT_TOLERANCE = 2.5

function nearlyStraight(pts: readonly number[]): boolean {
  const n = pts.length
  if (n < 4) return true
  const ax = pts[0]!
  const ay = pts[1]!
  const bx = pts[n - 2]!
  const by = pts[n - 1]!
  const length = Math.hypot(bx - ax, by - ay)
  if (length < 10) return false
  let worst = 0
  for (let i = 2; i + 1 < n - 2; i += 2) {
    worst = Math.max(
      worst,
      Math.abs((bx - ax) * (pts[i + 1]! - ay) - (by - ay) * (pts[i]! - ax)) / length,
    )
  }
  return worst < Math.max(1.5, length * 0.03)
}

/** Straight segments through the points, as a path. */
function straightPath(pts: readonly number[]): number[] {
  {
    const out = [pts[0]!, pts[1]!]
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const ax = pts[i - 2]!
      const ay = pts[i - 1]!
      const bx = pts[i]!
      const by = pts[i + 1]!
      out.push(
        ax + (bx - ax) / 3,
        ay + (by - ay) / 3,
        ax + ((bx - ax) * 2) / 3,
        ay + ((by - ay) * 2) / 3,
        bx,
        by,
      )
    }
    return out
  }
}

function segment(path: readonly number[], s: number): number[][] {
  const i = 2 + 6 * s
  return [
    [path[i - 2]!, path[i - 1]!],
    [path[i]!, path[i + 1]!],
    [path[i + 2]!, path[i + 3]!],
    [path[i + 4]!, path[i + 5]!],
  ]
}

function bezier(b: number[][], t: number): [number, number] {
  const mt = 1 - t
  const c = [mt * mt * mt, 3 * mt * mt * t, 3 * mt * t * t, t * t * t]
  let x = 0
  let y = 0
  for (let k = 0; k < 4; k++) {
    x += b[k]![0]! * c[k]!
    y += b[k]![1]! * c[k]!
  }
  return [x, y]
}
