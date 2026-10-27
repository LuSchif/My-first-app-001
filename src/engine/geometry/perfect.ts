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
