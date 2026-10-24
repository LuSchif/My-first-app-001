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
const MAX_LEAN = (18 * Math.PI) / 180
/** Lines closer than this (points) are one line; ends this close meet. */
const MERGE_PT = 8
const MEET_PT = 14
/** A grid line must run across at least this share of the table. */
const SPAN = 0.6
/** Smallest table, in points; smaller crossings are handwriting (a t, a +, a #). */
const MIN_WIDTH = 80
const MIN_HEIGHT = 50

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
 * The cell edges in one direction: the drawn lines plus the table's outer edges, unless a line
 * already sits at (or close to) that edge. Tiny strips at the edges are not cells.
 */
function withEdges(lines: number[], from: number, to: number): number[] {
  const gaps = lines.slice(1).map((v, i) => v - lines[i]!)
  const typical = gaps.length
    ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]! * 0.3
    : (to - from) * 0.15
  const near = Math.max(MERGE_PT * 2, typical)
  const out = [...lines]
  if (out[0]! - from > near) out.unshift(from)
  if (to - out[out.length - 1]! > near) out.push(to)
  return out
}

/**
 * The table that the stroke `lastId` completes, among nearby strokes. A table needs at least
 * two cells and three lines, each running most of the way across.
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
  if (hs.length < 1 || vs.length < 1) return null
  // The table reaches as far as its lines do; it may have no frame at all (a header line with
  // column dividers, or a # grid).
  const minX = Math.min(...hs.map((s) => s.a), ...vs.map((s) => s.at))
  const maxX = Math.max(...hs.map((s) => s.b), ...vs.map((s) => s.at))
  const minY = Math.min(...vs.map((s) => s.a), ...hs.map((s) => s.at))
  const maxY = Math.max(...vs.map((s) => s.b), ...hs.map((s) => s.at))
  if (maxX - minX < MIN_WIDTH || maxY - minY < MIN_HEIGHT) return null

  const lineYs = gridLines(hs, minX, maxX)
  const lineXs = gridLines(vs, minY, maxY)
  if (!lineXs || !lineYs || lineXs.length + lineYs.length < 3) return null
  const xs = withEdges(lineXs, minX, maxX)
  const ys = withEdges(lineYs, minY, maxY)
  if ((xs.length - 1) * (ys.length - 1) < 2) return null
  return { ids: [...new Set(grid.map((s) => s.id))], xs, ys }
}
