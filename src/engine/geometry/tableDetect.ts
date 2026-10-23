/**
 * Finds a hand-drawn table: straight horizontal and vertical lines that form a grid. The lines
 * can be drawn in any order and any way: one stroke per line, a rectangle for the frame, or
 * a whole corner in one go. The result keeps the spacing as drawn.
 */
import { simplify, toPts, type Pt } from './shapes.ts'

export interface TableSource {
  id: string
  points: readonly number[]
  closed?: boolean
}

export interface DrawnTable {
  /** The strokes the table is made of. */
  ids: string[]
  /** Positions of the vertical lines, left to right, and horizontal lines, top to bottom. */
  xs: number[]
  ys: number[]
}

/** How far a line may lean (radians) and still count as horizontal or vertical. */
const MAX_LEAN = (14 * Math.PI) / 180
/** Lines closer than this (points) are one line; ends this close meet. */
const MERGE_PT = 8
const MEET_PT = 14
/** A grid line must run across at least this share of the table. */
const SPAN = 0.75

interface Segment {
  id: string
  /** 'h': y is the line, a..b its x range. 'v': x is the line, a..b its y range. */
  dir: 'h' | 'v'
  at: number
  a: number
  b: number
}

/** The straight horizontal and vertical pieces of a stroke, or null if it has other parts. */
function segmentsOf(source: TableSource): Segment[] | null {
  const pts = toPts(source.points)
  if (source.closed && pts.length > 2) pts.push(pts[0]!)
  if (pts.length < 2) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const diag = Math.hypot(maxX - minX, maxY - minY)
  if (diag < 20) return null
  const corners = simplify(pts, Math.max(2.5, diag * 0.025))
  const out: Segment[] = []
  for (let i = 0; i + 1 < corners.length; i++) {
    const p: Pt = corners[i]!
    const q: Pt = corners[i + 1]!
    const dx = q.x - p.x
    const dy = q.y - p.y
    const length = Math.hypot(dx, dy)
    // Tiny hooks at the ends of a line do not matter.
    if (length < Math.max(6, diag * 0.06)) continue
    const lean = Math.atan2(Math.abs(dy), Math.abs(dx))
    if (lean < MAX_LEAN) {
      out.push({
        id: source.id,
        dir: 'h',
        at: (p.y + q.y) / 2,
        a: Math.min(p.x, q.x),
        b: Math.max(p.x, q.x),
      })
    } else if (lean > Math.PI / 2 - MAX_LEAN) {
      out.push({
        id: source.id,
        dir: 'v',
        at: (p.x + q.x) / 2,
        a: Math.min(p.y, q.y),
        b: Math.max(p.y, q.y),
      })
    } else {
      return null
    }
  }
  return out.length ? out : null
}

function crosses(h: Segment, v: Segment): boolean {
  return (
    v.at >= h.a - MEET_PT && v.at <= h.b + MEET_PT && h.at >= v.a - MEET_PT && h.at <= v.b + MEET_PT
  )
}

/** Positions of the grid lines in one direction, merging lines drawn in pieces. */
function gridLines(segments: Segment[], from: number, to: number): number[] | null {
  const sorted = [...segments].sort((s, t) => s.at - t.at)
  const groups: Segment[][] = []
  for (const s of sorted) {
    const last = groups[groups.length - 1]
    if (last && Math.abs(last[last.length - 1]!.at - s.at) < MERGE_PT) last.push(s)
    else groups.push([s])
  }
  const lines: number[] = []
  for (const group of groups) {
    // The covered length, joining pieces that overlap or nearly touch.
    const pieces = group.map((s) => [s.a, s.b] as const).sort((p, q) => p[0] - q[0])
    let covered = 0
    let start = pieces[0]![0]
    let end = pieces[0]![1]
    for (const [a, b] of pieces.slice(1)) {
      if (a <= end + MEET_PT) end = Math.max(end, b)
      else {
        covered += end - start
        start = a
        end = b
      }
    }
    covered += end - start
    if (covered < (to - from) * SPAN) return null
    lines.push(group.reduce((sum, s) => sum + s.at, 0) / group.length)
  }
  return lines
}

/**
 * The table that the stroke `lastId` completes, among nearby strokes. A table needs at least
 * two cells, with every line running (almost) all the way across.
 */
export function detectTable(sources: readonly TableSource[], lastId: string): DrawnTable | null {
  const segments: Segment[] = []
  for (const source of sources) segments.push(...(segmentsOf(source) ?? []))
  if (!segments.some((s) => s.id === lastId)) return null

  // The grid the last stroke belongs to: segments linked by crossings.
  const inGrid = new Set<Segment>(segments.filter((s) => s.id === lastId))
  let grew = true
  while (grew) {
    grew = false
    for (const s of segments) {
      if (inGrid.has(s)) continue
      for (const t of inGrid) {
        if (s.dir !== t.dir && crosses(s.dir === 'h' ? s : t, s.dir === 'h' ? t : s)) {
          inGrid.add(s)
          grew = true
          break
        }
      }
    }
  }
  const grid = [...inGrid]
  const hs = grid.filter((s) => s.dir === 'h')
  const vs = grid.filter((s) => s.dir === 'v')
  if (hs.length < 2 || vs.length < 2) return null
  const minX = Math.min(...vs.map((s) => s.at))
  const maxX = Math.max(...vs.map((s) => s.at))
  const minY = Math.min(...hs.map((s) => s.at))
  const maxY = Math.max(...hs.map((s) => s.at))
  if (maxX - minX < 30 || maxY - minY < 20) return null
  // Lines must not stick out far past the frame.
  if (hs.some((s) => s.a < minX - MEET_PT * 2 || s.b > maxX + MEET_PT * 2)) return null
  if (vs.some((s) => s.a < minY - MEET_PT * 2 || s.b > maxY + MEET_PT * 2)) return null

  const ys = gridLines(hs, minX, maxX)
  const xs = gridLines(vs, minY, maxY)
  if (!xs || !ys || xs.length < 2 || ys.length < 2) return null
  if ((xs.length - 1) * (ys.length - 1) < 2) return null
  return { ids: [...new Set(grid.map((s) => s.id))], xs, ys }
}
