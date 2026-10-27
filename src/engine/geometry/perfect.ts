/**
 * Hand-drawn lines made clean without changing what they look like: the line keeps its course,
 * size and proportions, wobbles and jitter are averaged out, turns and tips come out rounded,
 * and a nearly straight line becomes straight.
 */

type Pt = { x: number; y: number }

/** How far the smoothing reaches along the line, in points: a share of its length, within limits. */
const SMOOTH_SHARE = 0.025
const SMOOTH_MIN = 1.5
const SMOOTH_MAX = 8
/** A line straying less than this share of its length from straight becomes straight. */
const STRAIGHT_SHARE = 0.025

function pathLength(pts: readonly Pt[]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y)
  return l
}

/** Points at an even spacing along the line. */
function resample(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]!]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    let at = step - carry
    while (at <= d) {
      const t = at / d
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      at += step
    }
    carry = d - (at - step)
  }
  const last = pts[pts.length - 1]!
  const end = out[out.length - 1]!
  if (Math.hypot(last.x - end.x, last.y - end.y) > step * 0.3) out.push(last)
  else out[out.length - 1] = last
  return out
}

/** How far the points stray from the line between the first and the last. */
function deviation(pts: readonly Pt[]): number {
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
  let max = 0
  for (const p of pts) {
    max = Math.max(max, Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / l)
  }
  return max
}

/**
 * Smooths a stretch with fixed ends: each point becomes the average of its neighbours within a
 * reach of `half` points (fewer near the ends), three times over, close to a Gaussian blur.
 */
function smoothPiece(piece: readonly Pt[], half: number): Pt[] {
  let pts = piece.map((p) => ({ ...p }))
  for (let round = 0; round < 3; round++) {
    const next = pts.map((p) => ({ ...p }))
    for (let i = 1; i < pts.length - 1; i++) {
      const h = Math.min(half, i, pts.length - 1 - i)
      let x = 0
      let y = 0
      for (let j = i - h; j <= i + h; j++) {
        x += pts[j]!.x
        y += pts[j]!.y
      }
      next[i] = { x: x / (2 * h + 1), y: y / (2 * h + 1) }
    }
    pts = next
  }
  return pts
}

/**
 * The clean version of an open line, as points to join with straight segments. It follows the
 * drawn line exactly and only smooths what is unsteady: wobbles and jitter disappear, turns and
 * tips are rounded, and a line that is nearly straight becomes straight.
 */
export function perfectLine(flat: readonly number[]): number[] {
  const raw: Pt[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) raw.push({ x: flat[i]!, y: flat[i + 1]! })
  const total = pathLength(raw)
  if (raw.length < 3 || total < 2) return [...flat]
  if (deviation(raw) < Math.max(1.2, total * STRAIGHT_SHARE)) {
    return [raw[0]!.x, raw[0]!.y, raw[raw.length - 1]!.x, raw[raw.length - 1]!.y]
  }
  const step = Math.min(1, Math.max(0.25, total / 600))
  const pts = resample(raw, step)
  if (pts.length < 3) return [...flat]
  // Wobbles up to a few points long go; the drawn course, however curvy, stays.
  const reach = Math.min(SMOOTH_MAX, Math.max(SMOOTH_MIN, total * SMOOTH_SHARE))
  return smoothPiece(pts, Math.max(1, Math.round(reach / step))).flatMap((p) => [p.x, p.y])
}

/** How far the curve of a clean line may stray from it, in points. */
const PATH_TOLERANCE = 1.2

/**
 * A clean line (from `perfectLine`) as a vector path with as few anchors as it needs: its ends,
 * its high and low points (across the direction it runs), and only where one curve between
 * those cannot follow it closely enough, one more. The path format is the one of
 * `geometry/fitCurve.ts`: the start, then two control points and the end per segment.
 */
export function curvePath(flat: readonly number[]): number[] {
  const pts: Pt[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i]!, y: flat[i + 1]! })
  const n = pts.length
  if (n < 2) return [...flat]
  const first = pts[0]!
  const last = pts[n - 1]!
  if (n === 2) return [first.x, first.y, ...segment(pts, 0, 1)]
  // Across the direction the line runs: up and down for a line drawn from left to right.
  const cl = Math.hypot(last.x - first.x, last.y - first.y)
  const across =
    cl > 1e-6 ? { x: -(last.y - first.y) / cl, y: (last.x - first.x) / cl } : { x: 0, y: 1 }
  const height = (p: Pt) => p.x * across.x + p.y * across.y
  // High and low points that stand out by more than a little (not left-over unevenness).
  const total = pathLength(pts)
  const prominence = Math.max(1.5, total * 0.01)
  const anchors = [0]
  // 1 while the line climbs, -1 while it falls, 0 until it has done either by enough.
  let dir = 0
  let extreme = 0
  for (let i = 1; i < n; i++) {
    const h = height(pts[i]!)
    const he = height(pts[extreme]!)
    if (dir === 0) {
      if (Math.abs(h - he) > prominence) {
        dir = h > he ? 1 : -1
        extreme = i
      }
    } else if (dir * (h - he) > 0) {
      extreme = i
    } else if (dir * (he - h) > prominence) {
      anchors.push(extreme)
      dir = -dir
      extreme = i
    }
  }
  anchors.push(n - 1)
  // Split where a single curve does not follow the line closely enough.
  for (let round = 0; round < 32; round++) {
    let split = false
    for (let a = 0; a + 1 < anchors.length; a++) {
      const from = anchors[a]!
      const to = anchors[a + 1]!
      if (to - from < 4) continue
      const worst = worstFit(pts, from, to)
      if (worst.distance > PATH_TOLERANCE) {
        anchors.splice(a + 1, 0, worst.index)
        split = true
        a++
      }
    }
    if (!split) break
  }
  const out = [first.x, first.y]
  for (let a = 0; a + 1 < anchors.length; a++)
    out.push(...segment(pts, anchors[a]!, anchors[a + 1]!))
  return out
}

/** The direction the line runs at point `i`. */
function tangent(pts: readonly Pt[], i: number): Pt {
  const a = pts[Math.max(0, i - 2)]!
  const b = pts[Math.min(pts.length - 1, i + 2)]!
  const l = Math.hypot(b.x - a.x, b.y - a.y)
  return l > 1e-9 ? { x: (b.x - a.x) / l, y: (b.y - a.y) / l } : { x: 0, y: 0 }
}

/**
 * One curve from point `from` to point `to`, leaving and arriving in the line's direction, with
 * the handle lengths that fit the line between them best: least squares, refined a few times
 * by moving each point's place on the curve to where the curve comes closest (as in
 * illustration apps).
 */
function bezier(pts: readonly Pt[], from: number, to: number): [Pt, Pt, Pt, Pt] {
  const p0 = pts[from]!
  const p3 = pts[to]!
  const t0 = tangent(pts, from)
  const back = tangent(pts, to)
  const t1 = { x: -back.x, y: -back.y }
  const chord = Math.hypot(p3.x - p0.x, p3.y - p0.y)
  // Where along the curve each point lies: first by the length drawn up to it.
  const us = [0]
  for (let i = from + 1; i <= to; i++) {
    us.push(us[us.length - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y))
  }
  const total = us[us.length - 1]! || 1
  for (let i = 0; i < us.length; i++) us[i] = us[i]! / total
  let curve = fitHandles(pts, from, to, us, p0, p3, t0, t1, chord, total)
  for (let round = 0; round < 6; round++) {
    for (let i = 1; i < us.length - 1; i++) us[i] = closerU(curve, pts[from + i]!, us[i]!)
    curve = fitHandles(pts, from, to, us, p0, p3, t0, t1, chord, total)
  }
  return curve
}

function fitHandles(
  pts: readonly Pt[],
  from: number,
  to: number,
  us: readonly number[],
  p0: Pt,
  p3: Pt,
  t0: Pt,
  t1: Pt,
  chord: number,
  total: number,
): [Pt, Pt, Pt, Pt] {
  let c00 = 0
  let c01 = 0
  let c11 = 0
  let x0 = 0
  let x1 = 0
  for (let i = from; i <= to; i++) {
    const u = us[i - from]!
    const v = 1 - u
    const b0 = v * v * v
    const b1 = 3 * u * v * v
    const b2 = 3 * u * u * v
    const b3 = u * u * u
    const a1 = { x: t0.x * b1, y: t0.y * b1 }
    const a2 = { x: t1.x * b2, y: t1.y * b2 }
    c00 += a1.x * a1.x + a1.y * a1.y
    c01 += a1.x * a2.x + a1.y * a2.y
    c11 += a2.x * a2.x + a2.y * a2.y
    const p = pts[i]!
    const rx = p.x - (p0.x * (b0 + b1) + p3.x * (b2 + b3))
    const ry = p.y - (p0.y * (b0 + b1) + p3.y * (b2 + b3))
    x0 += a1.x * rx + a1.y * ry
    x1 += a2.x * rx + a2.y * ry
  }
  const det = c00 * c11 - c01 * c01
  let k0 = chord / 3
  let k1 = chord / 3
  if (Math.abs(det) > 1e-9) {
    k0 = (x0 * c11 - x1 * c01) / det
    k1 = (c00 * x1 - c01 * x0) / det
  }
  // Handles pointing backwards or far beyond the line would loop; fall back to a third.
  if (!(k0 > chord * 0.02 && k0 < total)) k0 = chord / 3
  if (!(k1 > chord * 0.02 && k1 < total)) k1 = chord / 3
  return [
    p0,
    { x: p0.x + t0.x * k0, y: p0.y + t0.y * k0 },
    { x: p3.x + t1.x * k1, y: p3.y + t1.y * k1 },
    p3,
  ]
}

/** One Newton step towards the place on the curve closest to `p`. */
function closerU([a, b, c, d]: [Pt, Pt, Pt, Pt], p: Pt, u: number): number {
  const v = 1 - u
  const q = {
    x: v * v * v * a.x + 3 * u * v * v * b.x + 3 * u * u * v * c.x + u * u * u * d.x,
    y: v * v * v * a.y + 3 * u * v * v * b.y + 3 * u * u * v * c.y + u * u * u * d.y,
  }
  const q1 = {
    x: 3 * (v * v * (b.x - a.x) + 2 * u * v * (c.x - b.x) + u * u * (d.x - c.x)),
    y: 3 * (v * v * (b.y - a.y) + 2 * u * v * (c.y - b.y) + u * u * (d.y - c.y)),
  }
  const q2 = {
    x: 6 * (v * (c.x - 2 * b.x + a.x) + u * (d.x - 2 * c.x + b.x)),
    y: 6 * (v * (c.y - 2 * b.y + a.y) + u * (d.y - 2 * c.y + b.y)),
  }
  const num = (q.x - p.x) * q1.x + (q.y - p.y) * q1.y
  const den = q1.x * q1.x + q1.y * q1.y + (q.x - p.x) * q2.x + (q.y - p.y) * q2.y
  if (Math.abs(den) < 1e-12) return u
  return Math.max(0, Math.min(1, u - num / den))
}

function segment(pts: readonly Pt[], from: number, to: number): number[] {
  const [, c1, c2, p3] = bezier(pts, from, to)
  return [c1.x, c1.y, c2.x, c2.y, p3.x, p3.y]
}

/** The point between `from` and `to` that the curve between them misses the most, and by how much. */
function worstFit(
  pts: readonly Pt[],
  from: number,
  to: number,
): { index: number; distance: number } {
  const [p0, c1, c2, p3] = bezier(pts, from, to)
  const samples: Pt[] = []
  const steps = Math.max(8, (to - from) * 2)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const u = 1 - t
    samples.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    })
  }
  let index = from
  let distance = 0
  for (let i = from + 1; i < to; i++) {
    const p = pts[i]!
    let best = Infinity
    for (const q of samples) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y))
    if (best > distance) {
      distance = best
      index = i
    }
  }
  return { index, distance }
}
