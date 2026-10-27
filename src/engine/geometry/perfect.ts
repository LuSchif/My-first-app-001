/**
 * Hand-drawn lines made clean without changing what they look like: wobbles are smoothed away,
 * nearly straight stretches become straight, and sharp corners stay corners. The line keeps its
 * size and proportions: only wobbles much shorter than the line are averaged out.
 */

type Pt = { x: number; y: number }

/** Turns sharper than this (in degrees) are corners, not part of a curve. */
const CORNER_ANGLE = 55
/** Wobbles shorter than about this share of the line are smoothed away. */
const SMOOTH_REACH = 0.035

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

/** Indices of sharp corners, judged over a stretch of `k` points on each side. */
function corners(pts: readonly Pt[], k: number): number[] {
  const turn: number[] = pts.map(() => 0)
  for (let i = k; i < pts.length - k; i++) {
    const a = pts[i - k]!
    const p = pts[i]!
    const b = pts[i + k]!
    const ax = p.x - a.x
    const ay = p.y - a.y
    const bx = b.x - p.x
    const by = b.y - p.y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) continue
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
    turn[i] = (Math.acos(cos) * 180) / Math.PI
  }
  const out: number[] = []
  for (let i = k; i < pts.length - k; i++) {
    if (turn[i]! < CORNER_ANGLE) continue
    let peak = true
    for (let j = Math.max(0, i - k); j <= Math.min(pts.length - 1, i + k); j++) {
      if (turn[j]! > turn[i]! || (turn[j] === turn[i] && j < i)) peak = false
    }
    if (peak) out.push(i)
  }
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
 * The clean version of an open line, as points to join with straight segments (dense along
 * curves, only the ends along straight stretches).
 */
export function perfectLine(flat: readonly number[]): number[] {
  const raw: Pt[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) raw.push({ x: flat[i]!, y: flat[i + 1]! })
  const total = pathLength(raw)
  if (raw.length < 3 || total < 2) return [...flat]
  const step = Math.min(3, Math.max(0.5, total / 120))
  const pts = resample(raw, step)
  if (pts.length < 3) return [...flat]
  const k = Math.max(2, Math.round(pts.length * 0.05))
  const cuts = [0, ...corners(pts, k), pts.length - 1]
  const out: Pt[] = []
  for (let c = 0; c < cuts.length - 1; c++) {
    const piece = pts.slice(cuts[c], cuts[c + 1]! + 1)
    const length = pathLength(piece)
    const straight = deviation(piece) < Math.max(1.2, length * 0.045)
    const half = Math.max(1, Math.round((total * SMOOTH_REACH) / step))
    const clean = straight ? [piece[0]!, piece[piece.length - 1]!] : smoothPiece(piece, half)
    out.push(...(c === 0 ? clean : clean.slice(1)))
  }
  return out.flatMap((p) => [p.x, p.y])
}
