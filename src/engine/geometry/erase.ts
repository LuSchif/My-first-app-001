import type { StrokeInput } from '../model/types.ts'

/**
 * Precise erasing: cuts the parts of a stroke that lie under the broom and returns the pieces
 * that remain, each a stroke of its own. Long segments are subdivided first, so a broom passing
 * between two distant samples still cuts the line. Every per-point value of the stroke (line
 * width, time, pressure, tilt) is carried into the pieces, interpolated where points are added.
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
  /** The recorded input of each remaining point, for strokes that have it. */
  input?: StrokeInput
}

/** Per-point values travelling with the points: name and values. */
type Channels = [string, readonly number[]][]

function channelsOf(widths?: readonly number[], input?: StrokeInput): Channels {
  const out: Channels = []
  if (widths) out.push(['widths', widths])
  if (input) {
    out.push(['t', input.t], ['p', input.p])
    if (input.altitude) out.push(['altitude', input.altitude])
    if (input.azimuth) out.push(['azimuth', input.azimuth])
  }
  return out
}

function pieceOf(points: number[], values: Map<string, number[]>, input?: StrokeInput) {
  const piece: StrokePiece = { points }
  const widths = values.get('widths')
  if (widths) piece.widths = widths
  if (input) {
    const t = values.get('t')!
    // Each piece keeps its own clock, starting at its first point.
    const t0 = t[0] ?? 0
    piece.input = {
      device: input.device,
      t: t.map((v) => Math.round(v - t0)),
      p: values.get('p')!,
      ...(values.has('altitude') ? { altitude: values.get('altitude')! } : {}),
      ...(values.has('azimuth') ? { azimuth: values.get('azimuth')! } : {}),
    }
  }
  return piece
}

/** Like `eraseFromPoints`, keeping each remaining point's line width and recorded input. */
export function eraseFromStroke(
  points: readonly number[],
  widths: readonly number[] | undefined,
  cx: number,
  cy: number,
  radius: number,
  input?: StrokeInput,
): StrokePiece[] | null {
  // Input that does not match the points (an older edit) is left behind rather than misplaced.
  const n = points.length / 2
  const recorded = input && input.t.length === n && input.p.length === n ? input : undefined
  const channels = channelsOf(widths?.length === n ? widths : undefined, recorded)
  const dense = subdivide(points, channels, Math.max(radius / 2, 0.5))
  const r2 = radius * radius
  let hit = false
  const pieces: StrokePiece[] = []
  let current: number[] = []
  let values = new Map<string, number[]>(channels.map(([k]) => [k, []]))
  const close = () => {
    if (current.length > 0) pieces.push(pieceOf(current, values, recorded))
    current = []
    values = new Map(channels.map(([k]) => [k, []]))
  }
  for (let i = 0; i < dense.points.length / 2; i++) {
    const x = dense.points[i * 2]!
    const y = dense.points[i * 2 + 1]!
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= r2) {
      hit = true
      close()
    } else {
      current.push(x, y)
      for (const [k, list] of dense.values) values.get(k)!.push(list[i]!)
    }
  }
  if (!hit) return null
  close()
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

/** Adds points along segments longer than `maxStep`, interpolating every per-point value. */
function subdivide(
  points: readonly number[],
  channels: Channels,
  maxStep: number,
): { points: number[]; values: Map<string, number[]> } {
  const out: number[] = []
  const values = new Map<string, number[]>(channels.map(([k]) => [k, []]))
  const n = points.length / 2
  for (let i = 0; i < n; i++) {
    const x = points[i * 2]!
    const y = points[i * 2 + 1]!
    if (i > 0) {
      const px = points[i * 2 - 2]!
      const py = points[i * 2 - 1]!
      const steps = Math.floor(Math.hypot(x - px, y - py) / maxStep)
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1)
        out.push(px + (x - px) * t, py + (y - py) * t)
        for (const [k, list] of channels) {
          const a = list[i - 1]!
          values.get(k)!.push(a + (list[i]! - a) * t)
        }
      }
    }
    out.push(x, y)
    for (const [k, list] of channels) values.get(k)!.push(list[i]!)
  }
  return { points: out, values }
}
