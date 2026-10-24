/**
 * Precise erasing: cuts the parts of a stroke that lie under the broom and returns the pieces
 * that remain. Long segments are subdivided first, so a broom passing between two distant
 * samples still cuts the line.
 */
export function eraseFromPoints(
  points: readonly number[],
  cx: number,
  cy: number,
  radius: number,
): number[][] | null {
  return eraseFromStroke(points, undefined, cx, cy, radius)?.map((p) => p.points) ?? null
}

export interface StrokePiece {
  points: number[]
  /** The line width at each point, for strokes that have one. */
  widths?: number[]
}

/** Like `eraseFromPoints`, keeping each remaining point's line width. */
export function eraseFromStroke(
  points: readonly number[],
  widths: readonly number[] | undefined,
  cx: number,
  cy: number,
  radius: number,
): StrokePiece[] | null {
  const dense = subdivide(points, widths, Math.max(radius / 2, 0.5))
  const r2 = radius * radius
  let hit = false
  const pieces: StrokePiece[] = []
  let current: StrokePiece = widths ? { points: [], widths: [] } : { points: [] }
  for (let i = 0; i < dense.points.length / 2; i++) {
    const x = dense.points[i * 2]!
    const y = dense.points[i * 2 + 1]!
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= r2) {
      hit = true
      if (current.points.length > 0) pieces.push(current)
      current = widths ? { points: [], widths: [] } : { points: [] }
    } else {
      current.points.push(x, y)
      current.widths?.push(dense.widths[i]!)
    }
  }
  if (!hit) return null
  if (current.points.length > 0) pieces.push(current)
  // A lone leftover sample would show as a dot; drop it.
  return pieces.filter((p) => p.points.length >= 4)
}

/** Whether any part of the stroke passes within `radius` of the point. */
export function strokeTouchesCircle(
  points: readonly number[],
  cx: number,
  cy: number,
  radius: number,
): boolean {
  const n = points.length / 2
  if (n === 1) return Math.hypot(points[0]! - cx, points[1]! - cy) <= radius
  for (let i = 0; i < n - 1; i++) {
    const d = distanceToSegment(
      cx,
      cy,
      points[i * 2]!,
      points[i * 2 + 1]!,
      points[i * 2 + 2]!,
      points[i * 2 + 3]!,
    )
    if (d <= radius) return true
  }
  return false
}

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function subdivide(
  points: readonly number[],
  widths: readonly number[] | undefined,
  maxStep: number,
): { points: number[]; widths: number[] } {
  const out: number[] = []
  const outW: number[] = []
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const x = points[i * 2]!
    const y = points[i * 2 + 1]!
    const w = widths?.[i] ?? 0
    if (i > 0) {
      const px = points[i * 2 - 2]!
      const py = points[i * 2 - 1]!
      const pw = widths?.[i - 1] ?? 0
      const steps = Math.floor(Math.hypot(x - px, y - py) / maxStep)
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1)
        out.push(px + (x - px) * t, py + (y - py) * t)
        outW.push(pw + (w - pw) * t)
      }
    }
    out.push(x, y)
    outW.push(w)
  }
  return { points: out, widths: outW }
}
