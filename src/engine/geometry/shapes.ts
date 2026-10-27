/**
 * Shape geometry for Auto shape and Auto fill: closed outlines, the region enclosed at a point,
 * and recognition of hand-drawn circles, polygons and U-shaped curves. All coordinates are page
 * points; strokes are flat lists x0, y0, x1, y1, …
 */

export interface Pt {
  x: number
  y: number
}

export type ShapeKind =
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'square'
  | 'rectangle'
  | 'quadrilateral'
  | 'pentagon'
  | 'parabola'
  | 'line'

const LABELS: Record<ShapeKind, string> = {
  circle: 'Circle',
  ellipse: 'Ellipse',
  triangle: 'Triangle',
  square: 'Square',
  rectangle: 'Rectangle',
  quadrilateral: 'Quadrilateral',
  pentagon: 'Pentagon',
  parabola: 'Curve',
  line: 'Line',
}

export interface Shape {
  kind: ShapeKind
  label: string
  points: number[]
  closed: boolean
  /** Straight edges between the points (polygons) instead of a smooth curve. */
  straight: boolean
}

export interface OutlineSource {
  id: string
  points: readonly number[]
  closed?: boolean
  straight?: boolean
}

export interface Region {
  points: number[]
  /** Whether the outline is drawn as a smooth curve through the points. */
  smooth: boolean
  area: number
  /** The strokes that form the outline. */
  sourceIds: string[]
}

// ---------- Basics ----------

export function toPts(flat: readonly number[]): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]!, y: flat[i + 1]! })
  return out
}

export function toFlat(pts: readonly Pt[]): number[] {
  return pts.flatMap((p) => [p.x, p.y])
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function diagonal(pts: readonly Pt[]): number {
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
  return Math.hypot(maxX - minX, maxY - minY)
}

export function polygonArea(pts: readonly Pt[]): number {
  let sum = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    sum += pts[j]!.x * pts[i]!.y - pts[i]!.x * pts[j]!.y
  }
  return Math.abs(sum) / 2
}

export function insidePolygon(x: number, y: number, pts: readonly Pt[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Points spaced evenly along the path; for a closed path the closing edge is included. */
export function resample(pts: readonly Pt[], count: number, closed = false): Pt[] {
  const path = closed ? [...pts, pts[0]!] : [...pts]
  let total = 0
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1]!, path[i]!)
  if (total === 0) return [path[0]!]
  const step = total / (closed ? count : count - 1)
  const out: Pt[] = [path[0]!]
  let carried = 0
  for (let i = 1; i < path.length && out.length < count; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const len = dist(a, b)
    let along = step - carried
    while (along <= len && out.length < count) {
      const t = along / len
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      along += step
    }
    carried = len - (along - step)
  }
  if (!closed && out.length < count) out.push(path[path.length - 1]!)
  return out
}

function intersection(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (den === 0) return null
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t))
}

// ---------- Closed outlines ----------

const loops = new WeakMap<readonly number[], Pt[] | null>()

/**
 * The closed outline a stroke draws, if any: either its ends meet (within a fifth of its size),
 * or it crosses itself, in which case the first loop it forms counts.
 */
export function closedLoop(flat: readonly number[], markedClosed = false): Pt[] | null {
  if (loops.has(flat)) return loops.get(flat)!
  const result = findLoop(toPts(flat), markedClosed)
  loops.set(flat, result)
  return result
}

function findLoop(pts: Pt[], markedClosed: boolean): Pt[] | null {
  if (pts.length < 3) return null
  if (markedClosed) return pts
  const diag = diagonal(pts)
  if (diag < 4 || pts.length < 6) return null
  if (dist(pts[0]!, pts[pts.length - 1]!) <= Math.max(5, 0.2 * diag)) {
    const loop = trimOvershoot(pts)
    return polygonArea(loop) > 0.02 * diag * diag ? loop : null
  }
  for (let j = 2; j < pts.length - 1; j++) {
    for (let i = 0; i < j - 1; i++) {
      const hit = intersection(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!)
      if (!hit) continue
      const loop = [hit, ...pts.slice(i + 1, j + 1)]
      if (polygonArea(loop) > 0.02 * diag * diag) return loop
    }
  }
  return null
}

/** Drawing past the starting point adds a short tail; end the loop where it comes closest. */
function trimOvershoot(pts: Pt[]): Pt[] {
  const from = Math.floor(pts.length * 0.7)
  let best = pts.length - 1
  let bestDist = dist(pts[0]!, pts[best]!)
  for (let i = from; i < pts.length; i++) {
    const d = dist(pts[0]!, pts[i]!)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return pts.slice(0, best + 1)
}

/**
 * The smallest closed area around (x, y): one closed stroke, or several strokes joined end to
 * end (a triangle drawn as three lines, for example).
 */
export function regionAt(sources: readonly OutlineSource[], x: number, y: number): Region | null {
  let best: Region | null = null
  const consider = (pts: Pt[], smooth: boolean, ids: string[]) => {
    if (!insidePolygon(x, y, pts)) return
    const area = polygonArea(pts)
    if (!best || area < best.area) best = { points: toFlat(pts), smooth, area, sourceIds: ids }
  }

  const open: { id: string; pts: Pt[] }[] = []
  for (const s of sources) {
    const loop = closedLoop(s.points, s.closed)
    if (loop) consider(loop, loop.length === s.points.length / 2 && !s.straight, [s.id])
    else if (s.points.length >= 4) open.push({ id: s.id, pts: toPts(s.points) })
  }

  for (const chain of chains(open)) consider(chain.pts, false, chain.ids)
  return best ?? enclosedArea(sources, x, y)
}

/** The grid an enclosed area is looked for in has at most this many cells along a side. */
const AREA_GRID = 240

/**
 * The area around (x, y) that the strokes close off together, however they meet: a shape drawn
 * onto another one, a line across a circle. The strokes are drawn into a grid, the grid is
 * filled from (x, y), and the outline of what was filled is the area. Null when the filling
 * runs out of the strokes' reach (the spot is not closed in).
 */
export function enclosedArea(
  sources: readonly OutlineSource[],
  x: number,
  y: number,
): Region | null {
  if (!sources.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of sources) {
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      minX = Math.min(minX, s.points[i]!)
      maxX = Math.max(maxX, s.points[i]!)
      minY = Math.min(minY, s.points[i + 1]!)
      maxY = Math.max(maxY, s.points[i + 1]!)
    }
  }
  if (x <= minX || x >= maxX || y <= minY || y >= maxY) return null
  const cell = Math.max(0.75, Math.max(maxX - minX, maxY - minY) / AREA_GRID)
  // One empty cell all around, so the filling can tell when it got out.
  const ox = minX - cell * 2
  const oy = minY - cell * 2
  const w = Math.ceil((maxX - minX) / cell) + 4
  const h = Math.ceil((maxY - minY) / cell) + 4
  const wall = new Uint8Array(w * h)
  const mark = (px: number, py: number) => {
    const cx = Math.floor((px - ox) / cell)
    const cy = Math.floor((py - oy) / cell)
    // Each line is drawn two cells wide, so the filling cannot slip between its cells.
    for (let dy = -1; dy <= 0; dy++) {
      for (let dx = -1; dx <= 0; dx++) {
        const gx = cx + dx
        const gy = cy + dy
        if (gx >= 0 && gy >= 0 && gx < w && gy < h) wall[gy * w + gx] = 1
      }
    }
  }
  for (const s of sources) {
    const pts = toPts(s.points)
    if (s.closed && pts.length > 2) pts.push(pts[0]!)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!
      const b = pts[i]!
      const steps = Math.max(1, Math.ceil(dist(a, b) / (cell * 0.5)))
      for (let k = 0; k <= steps; k++)
        mark(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps)
    }
  }
  const start = Math.floor((y - oy) / cell) * w + Math.floor((x - ox) / cell)
  if (wall[start]) return null
  const filled = new Uint8Array(w * h)
  const queue = [start]
  filled[start] = 1
  let count = 0
  while (queue.length) {
    const i = queue.pop()!
    count++
    const gx = i % w
    const gy = (i - gx) / w
    // Reaching the empty border means the spot is open to the outside.
    if (gx === 0 || gy === 0 || gx === w - 1 || gy === h - 1) return null
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (!filled[j] && !wall[j]) {
        filled[j] = 1
        queue.push(j)
      }
    }
  }
  // Grown by one cell, so the area reaches under the middle of its outlines.
  const grown = new Uint8Array(filled)
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]) continue
    for (const j of [i - 1, i + 1, i - w, i + w]) grown[j] = 1
  }
  const outline = traceOutline(grown, w, h)
  if (outline.length < 3) return null
  const pts = simplify(
    outline.map((p) => ({ x: ox + p.x * cell, y: oy + p.y * cell })),
    cell * 0.6,
  )
  // The strokes that close it off: the ones running along its edge.
  const edge = new Set<number>()
  for (let i = 0; i < grown.length; i++) {
    if (grown[i] && !filled[i]) edge.add(i)
  }
  const sourceIds = sources
    .filter((s) => {
      for (let i = 0; i + 1 < s.points.length; i += 2) {
        const cx = Math.floor((s.points[i]! - ox) / cell)
        const cy = Math.floor((s.points[i + 1]! - oy) / cell)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) if (edge.has((cy + dy) * w + cx + dx)) return true
        }
      }
      return false
    })
    .map((s) => s.id)
  return { points: toFlat(pts), smooth: false, area: count * cell * cell, sourceIds }
}

/**
 * The outline of the set cells of a grid (one connected group), as the corners of the cells
 * along it, going around once.
 */
function traceOutline(cells: Uint8Array, w: number, h: number): Pt[] {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && cells[y * w + x] === 1
  // Edges between a set cell and an unset one, each going around the set cells clockwise.
  const next = new Map<string, Pt>()
  let first: Pt | null = null
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue
      if (!at(x, y - 1)) next.set(`${x},${y}`, { x: x + 1, y })
      if (!at(x + 1, y)) next.set(`${x + 1},${y}`, { x: x + 1, y: y + 1 })
      if (!at(x, y + 1)) next.set(`${x + 1},${y + 1}`, { x, y: y + 1 })
      if (!at(x - 1, y)) next.set(`${x},${y + 1}`, { x, y })
      first ??= { x, y }
    }
  }
  if (!first) return []
  const out: Pt[] = []
  let p: Pt = first
  for (let guard = 0; guard < next.size + 1; guard++) {
    out.push(p)
    const q = next.get(`${p.x},${p.y}`)
    if (!q || (q.x === first.x && q.y === first.y)) break
    p = q
  }
  return out
}

const JOIN_PT = 10
const MAX_CHAIN = 6

/** Closed loops made of several open strokes whose ends touch. */
function chains(strokes: { id: string; pts: Pt[] }[]): { pts: Pt[]; ids: string[] }[] {
  const found: { pts: Pt[]; ids: string[] }[] = []
  const seen = new Set<string>()
  const near = (a: Pt, b: Pt) => dist(a, b) <= JOIN_PT

  const extend = (start: Pt, end: Pt, used: number[], pts: Pt[]) => {
    if (used.length >= 2 && near(end, start)) {
      const key = [...used].sort().join()
      if (!seen.has(key)) {
        seen.add(key)
        found.push({ pts, ids: used.map((i) => strokes[i]!.id) })
      }
      return
    }
    if (used.length >= MAX_CHAIN) return
    strokes.forEach((s, i) => {
      if (used.includes(i) || i < used[0]!) return
      const first = s.pts[0]!
      const last = s.pts[s.pts.length - 1]!
      if (near(end, first)) extend(start, last, [...used, i], [...pts, ...s.pts])
      else if (near(end, last))
        extend(start, first, [...used, i], [...pts, ...[...s.pts].reverse()])
    })
  }

  strokes.forEach((s, i) => {
    extend(s.pts[0]!, s.pts[s.pts.length - 1]!, [i], s.pts)
  })
  return found
}

// ---------- Recognition ----------

/** Recognizes a drawn stroke as a clean shape, keeping its position, size and proportions. */
export function recognizeShape(flat: readonly number[]): Shape | null {
  const pts = toPts(flat)
  if (pts.length < 8) return null
  const loop = closedLoop(flat)
  if (loop) return recognizeClosed(loop)
  return recognizeLine(pts) ?? recognizeParabola(pts)
}

function recognizeClosed(loop: Pt[]): Shape | null {
  const pts = resample(loop, 96, true)
  const diag = diagonal(pts)
  const ellipse = fitEllipse(pts)
  const polygon = fitPolygon(pts, diag)

  // A drawn circle also simplifies to a polygon of 5–6 soft corners, and a pentagon is nearly
  // round, so only a close ellipse fit wins first; then clear corners; then a looser ellipse.
  if (ellipse && ellipse.error < 0.035) return ellipseShape(ellipse)
  if (polygon) return polygon
  if (ellipse && ellipse.error < 0.1) return ellipseShape(ellipse)
  return null
}

interface Ellipse {
  cx: number
  cy: number
  a: number
  b: number
  angle: number
  error: number
}

/** Fits an ellipse from the spread of evenly spaced outline points (their covariance). */
function fitEllipse(pts: Pt[]): Ellipse | null {
  const n = pts.length
  const cx = pts.reduce((s, p) => s + p.x, 0) / n
  const cy = pts.reduce((s, p) => s + p.y, 0) / n
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of pts) {
    sxx += (p.x - cx) ** 2
    syy += (p.y - cy) ** 2
    sxy += (p.x - cx) * (p.y - cy)
  }
  sxx /= n
  syy /= n
  sxy /= n
  const tr = sxx + syy
  const det = sxx * syy - sxy * sxy
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  // On an ellipse traced at even speed, coordinate variance is about half the squared radius.
  const a = Math.sqrt(2 * l1)
  const b = Math.sqrt(2 * Math.max(l2, 0))
  if (a === 0 || b / a < 0.15) return null
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  let error = 0
  for (const p of pts) {
    const u = (p.x - cx) * cos + (p.y - cy) * sin
    const v = -(p.x - cx) * sin + (p.y - cy) * cos
    error += Math.abs(Math.hypot(u / a, v / b) - 1)
  }
  return { cx, cy, a, b, angle, error: error / n }
}

function ellipseShape(e: Ellipse): Shape {
  const circle = e.b / e.a > 0.9
  const a = circle ? (e.a + e.b) / 2 : e.a
  const b = circle ? a : e.b
  const points: number[] = []
  const cos = Math.cos(e.angle)
  const sin = Math.sin(e.angle)
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2
    const u = a * Math.cos(t)
    const v = b * Math.sin(t)
    points.push(e.cx + u * cos - v * sin, e.cy + u * sin + v * cos)
  }
  return {
    kind: circle ? 'circle' : 'ellipse',
    label: circle ? LABELS.circle : LABELS.ellipse,
    points,
    closed: true,
    straight: false,
  }
}

/** Finds the corners of a closed outline and, for 3 to 5 corners, the clean polygon. */
function fitPolygon(pts: Pt[], diag: number): Shape | null {
  let corners = mergeShortEdges(cornersOf(pts, diag))
  if (corners.length < 3 || corners.length > 5) return null
  // Every outline point must lie close to the polygon's edges.
  let error = 0
  for (const p of pts) {
    let d = Infinity
    for (let i = 0; i < corners.length; i++) {
      d = Math.min(d, distanceToSegment(p, corners[i]!, corners[(i + 1) % corners.length]!))
    }
    error += d
  }
  if (error / pts.length / diag > 0.035) return null

  const names = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon' } as const
  let kind: ShapeKind = names[corners.length as 3 | 4 | 5]
  if (kind === 'quadrilateral' && nearlyRectangular(corners)) {
    corners = rectangleThrough(corners)
    kind = 'rectangle'
    // Sides within 15% of each other were meant to be equal.
    const w = dist(corners[0]!, corners[1]!)
    const h = dist(corners[1]!, corners[2]!)
    if (Math.abs(w - h) / Math.max(w, h) < 0.15) {
      corners = regularPolygon(
        4,
        centroid(corners),
        (w + h) / 2 / Math.SQRT2,
        edgeAngle(corners) + Math.PI / 4,
      )
      kind = 'square'
    }
  }
  return { kind, label: LABELS[kind], points: toFlat(corners), closed: true, straight: true }
}

/** Corners by Douglas–Peucker on the closed outline, then dropping nearly straight ones. */
function cornersOf(pts: Pt[], diag: number): Pt[] {
  const n = pts.length
  // Split the loop at two far-apart points so both halves are simplified as open paths.
  let a = 0
  let b = 0
  let far = -1
  for (let j = 1; j < n; j++) {
    const d = dist(pts[0]!, pts[j]!)
    if (d > far) {
      far = d
      a = j
    }
  }
  far = -1
  for (let j = 0; j < n; j++) {
    const d = dist(pts[a]!, pts[j]!)
    if (d > far) {
      far = d
      b = j
    }
  }
  const [i0, i1] = a < b ? [a, b] : [b, a]
  const eps = 0.06 * diag
  const first = simplify(pts.slice(i0, i1 + 1), eps)
  const second = simplify([...pts.slice(i1), ...pts.slice(0, i0 + 1)], eps)
  let corners = [...first.slice(0, -1), ...second.slice(0, -1)]

  // Drop corners that are barely bent or sit right next to another corner.
  let changed = true
  while (changed && corners.length > 3) {
    changed = false
    for (let i = 0; i < corners.length; i++) {
      const prev = corners[(i + corners.length - 1) % corners.length]!
      const cur = corners[i]!
      const next = corners[(i + 1) % corners.length]!
      const v1 = { x: prev.x - cur.x, y: prev.y - cur.y }
      const v2 = { x: next.x - cur.x, y: next.y - cur.y }
      const cos =
        (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1)
      const angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
      if (angle > 155 || dist(cur, next) < 0.1 * diag) {
        corners = corners.filter((_, k) => k !== i)
        changed = true
        break
      }
    }
  }
  return corners
}

export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  let index = -1
  let max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distanceToSegment(pts[i]!, a, b)
    if (d > max) {
      max = d
      index = i
    }
  }
  if (max <= eps) return [a, b]
  return [
    ...simplify(pts.slice(0, index + 1), eps).slice(0, -1),
    ...simplify(pts.slice(index), eps),
  ]
}

function nearlyRectangular(c: Pt[]): boolean {
  for (let i = 0; i < 4; i++) {
    const prev = c[(i + 3) % 4]!
    const cur = c[i]!
    const next = c[(i + 1) % 4]!
    const angle =
      Math.abs(
        Math.atan2(prev.y - cur.y, prev.x - cur.x) - Math.atan2(next.y - cur.y, next.x - cur.x),
      ) *
      (180 / Math.PI)
    const interior = angle > 180 ? 360 - angle : angle
    if (Math.abs(interior - 90) > 20) return false
  }
  return true
}

/** The rectangle aligned with the drawn edges that covers the same corners. */
function rectangleThrough(c: Pt[]): Pt[] {
  // Average the edge directions (folded into one quarter turn) to find the rectangle's angle.
  let sx = 0
  let sy = 0
  for (let i = 0; i < 4; i++) {
    const a = c[i]!
    const b = c[(i + 1) % 4]!
    const t = Math.atan2(b.y - a.y, b.x - a.x) * 4
    const w = dist(a, b)
    sx += Math.cos(t) * w
    sy += Math.sin(t) * w
  }
  const angle = Math.atan2(sy, sx) / 4
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const local = c.map((p) => ({ u: p.x * cos + p.y * sin, v: -p.x * sin + p.y * cos }))
  // Each side of the rectangle lies between the two corners closest to it, whichever corner the
  // drawing started at.
  const us = local.map((p) => p.u).sort((a, b) => a - b)
  const vs = local.map((p) => p.v).sort((a, b) => a - b)
  const u0 = (us[0]! + us[1]!) / 2
  const u1 = (us[2]! + us[3]!) / 2
  const v0 = (vs[0]! + vs[1]!) / 2
  const v1 = (vs[2]! + vs[3]!) / 2
  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => ({ x: u! * cos - v! * sin, y: u! * sin + v! * cos }))
}

/** A U-shaped open curve: a parabola along the curve's own axis. */
function recognizeParabola(raw: Pt[]): Shape | null {
  const pts = resample(raw, 64)
  const diag = diagonal(pts)
  if (diag < 4) return null
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const chord = Math.atan2(pts[pts.length - 1]!.y - pts[0]!.y, pts[pts.length - 1]!.x - pts[0]!.x)

  // The opening of a U runs along the line between its two ends.
  for (const angle of [chord, chord + Math.PI / 2]) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const local = pts.map((p) => ({
      u: (p.x - cx) * cos + (p.y - cy) * sin,
      v: -(p.x - cx) * sin + (p.y - cy) * cos,
    }))
    if (
      !monotonic(
        local.map((p) => p.u),
        diag,
      )
    )
      continue
    const fit = fitQuadratic(local)
    if (!fit) continue
    const u0 = local[0]!.u
    const u1 = local[local.length - 1]!.u
    const half = Math.abs(u1 - u0) / 2
    const depth = Math.abs(fit.a) * half * half
    if (fit.rms > 0.035 * diag || depth < 0.2 * half) continue
    const points: number[] = []
    for (let i = 0; i <= 48; i++) {
      const u = u0 + ((u1 - u0) * i) / 48
      const v = fit.a * u * u + fit.b * u + fit.c
      points.push(cx + u * cos - v * sin, cy + u * sin + v * cos)
    }
    return { kind: 'parabola', label: LABELS.parabola, points, closed: false, straight: false }
  }
  return null
}

function monotonic(us: number[], diag: number): boolean {
  const dir = Math.sign(us[us.length - 1]! - us[0]!)
  if (dir === 0) return false
  let back = 0
  for (let i = 1; i < us.length; i++) back += Math.max(0, -dir * (us[i]! - us[i - 1]!))
  // A shaky hand steps back a little now and then; a curve that turns around steps back a lot.
  return back < 0.15 * diag
}

/** Least-squares v = a·u² + b·u + c. */
function fitQuadratic(pts: { u: number; v: number }[]) {
  let s0 = 0
  let s1 = 0
  let s2 = 0
  let s3 = 0
  let s4 = 0
  let t0 = 0
  let t1 = 0
  let t2 = 0
  for (const { u, v } of pts) {
    s0 += 1
    s1 += u
    s2 += u * u
    s3 += u * u * u
    s4 += u * u * u * u
    t0 += v
    t1 += u * v
    t2 += u * u * v
  }
  const m = [
    [s4, s3, s2, t2],
    [s3, s2, s1, t1],
    [s2, s1, s0, t0],
  ]
  const det3 = (r: number[][]) =>
    r[0]![0]! * (r[1]![1]! * r[2]![2]! - r[1]![2]! * r[2]![1]!) -
    r[0]![1]! * (r[1]![0]! * r[2]![2]! - r[1]![2]! * r[2]![0]!) +
    r[0]![2]! * (r[1]![0]! * r[2]![1]! - r[1]![1]! * r[2]![0]!)
  const base = m.map((r) => r.slice(0, 3))
  const d = det3(base)
  if (Math.abs(d) < 1e-9) return null
  const col = (k: number) => base.map((r, i) => r.map((x, j) => (j === k ? m[i]![3]! : x)))
  const a = det3(col(0)) / d
  const b = det3(col(1)) / d
  const c = det3(col(2)) / d
  let sq = 0
  for (const { u, v } of pts) sq += (a * u * u + b * u + c - v) ** 2
  return { a, b, c, rms: Math.sqrt(sq / pts.length) }
}

/** A stroke that barely strays from the line between its ends. */
function recognizeLine(pts: Pt[]): Shape | null {
  const a = pts[0]!
  const b = pts[pts.length - 1]!
  const length = dist(a, b)
  if (length < 10) return null
  let max = 0
  let sum = 0
  for (const p of pts) {
    const d = distanceToSegment(p, a, b)
    max = Math.max(max, d)
    sum += d
  }
  if (max > 0.04 * length + 1.5 || sum / pts.length > 0.015 * length + 0.5) return null
  return {
    kind: 'line',
    label: LABELS.line,
    points: [a.x, a.y, b.x, b.y],
    closed: false,
    straight: true,
  }
}

/**
 * A rounded corner can come out of the simplification as two corners joined by a short edge.
 * Such pairs become one corner where the two neighbouring edges meet.
 */
function mergeShortEdges(corners: Pt[]): Pt[] {
  let out = corners
  for (let guard = 0; guard < 4 && out.length > 3; guard++) {
    const n = out.length
    const lengths = out.map((p, i) => dist(p, out[(i + 1) % n]!))
    const average = lengths.reduce((s, l) => s + l, 0) / n
    const i = lengths.indexOf(Math.min(...lengths))
    if (lengths[i]! > 0.3 * average) break
    const prev = out[(i - 1 + n) % n]!
    const a = out[i]!
    const b = out[(i + 1) % n]!
    const next = out[(i + 2) % n]!
    const meet = lineIntersection(prev, a, b, next) ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    out = out.flatMap((p, k) => (k === i ? [meet] : k === (i + 1) % n ? [] : [p]))
  }
  return out
}

function lineIntersection(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function centroid(pts: readonly Pt[]): Pt {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function edgeAngle(corners: readonly Pt[]): number {
  return Math.atan2(corners[1]!.y - corners[0]!.y, corners[1]!.x - corners[0]!.x)
}

/** Corners of a regular polygon; the first corner points in direction `rotation`. */
function regularPolygon(n: number, center: Pt, radius: number, rotation: number): Pt[] {
  return Array.from({ length: n }, (_, k) => {
    const t = rotation + (k * 2 * Math.PI) / n
    return { x: center.x + radius * Math.cos(t), y: center.y + radius * Math.sin(t) }
  })
}

/** Rounds an angle to the nearest multiple of `step`. */
function snapAngle(angle: number, step: number): number {
  return Math.round(angle / step) * step
}

/**
 * The closed outline formed by a stroke together with others joined to it end to end, such as
 * the four sides of a square drawn one by one.
 */
export function chainThrough(
  sources: readonly OutlineSource[],
  id: string,
): { points: number[]; ids: string[] } | null {
  const open = sources
    .filter((s) => !closedLoop(s.points, s.closed))
    .map((s) => ({ id: s.id, pts: toPts(s.points) }))
  let best: { points: number[]; ids: string[]; area: number } | null = null
  for (const chain of chains(open)) {
    if (!chain.ids.includes(id)) continue
    const area = polygonArea(chain.pts)
    if (!best || area < best.area) best = { points: toFlat(chain.pts), ids: chain.ids, area }
  }
  return best && { points: best.points, ids: best.ids }
}

/**
 * The ideal version of a recognized shape, the same size and roughly the same orientation:
 * equal sides and angles, a true circle, a straight line at a clean angle, a symmetric curve.
 */
export function perfectShape(shape: Shape): Shape {
  const pts = toPts(shape.points)
  const c = centroid(pts)
  const quarter = Math.PI / 12
  switch (shape.kind) {
    case 'circle':
    case 'ellipse': {
      // Same area as the drawn ellipse.
      const radius = Math.sqrt(polygonArea(pts) / Math.PI)
      return ellipseShape({ cx: c.x, cy: c.y, a: radius, b: radius, angle: 0, error: 0 })
    }
    case 'triangle':
    case 'pentagon':
    case 'square':
    case 'rectangle':
    case 'quadrilateral': {
      const n = pts.length
      const radius = pts.reduce((s, p) => s + dist(p, c), 0) / n
      // Average the corner directions (folded by the polygon's symmetry) for its orientation.
      let sx = 0
      let sy = 0
      for (const p of pts) {
        const t = Math.atan2(p.y - c.y, p.x - c.x) * n
        sx += Math.cos(t)
        sy += Math.sin(t)
      }
      const rotation = snapAngle(Math.atan2(sy, sx) / n, quarter)
      const kind: ShapeKind = n === 3 ? 'triangle' : n === 4 ? 'square' : 'pentagon'
      return {
        kind,
        label: LABELS[kind],
        points: toFlat(regularPolygon(n, c, radius, rotation)),
        closed: true,
        straight: true,
      }
    }
    case 'line': {
      const [a, b] = pts as [Pt, Pt]
      const length = dist(a, b)
      const angle = snapAngle(Math.atan2(b.y - a.y, b.x - a.x), quarter)
      return {
        ...shape,
        points: [a.x, a.y, a.x + length * Math.cos(angle), a.y + length * Math.sin(angle)],
      }
    }
    case 'parabola': {
      // Mirror-symmetric around the middle: the same width, opening and depth.
      const a = pts[0]!
      const b = pts[pts.length - 1]!
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const vertex = pts.reduce(
        (far, p) => (distanceToSegment(p, a, b) > distanceToSegment(far, a, b) ? p : far),
        a,
      )
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      const half = dist(a, b) / 2
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      const depth = (vertex.x - mid.x) * -uy + (vertex.y - mid.y) * ux
      const points: number[] = []
      for (let i = 0; i <= 48; i++) {
        const u = -half + (2 * half * i) / 48
        const v = depth * (1 - (u * u) / (half * half))
        points.push(mid.x + u * ux - v * uy, mid.y + u * uy + v * ux)
      }
      return { ...shape, points }
    }
  }
}
