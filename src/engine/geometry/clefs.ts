import { flattenStroke, nibWidthAt } from './nib.ts'
import { boundsOfPoints, type Rect } from './rect.ts'
import { smoothedValueAt } from './strokePath.ts'

/**
 * Clefs on music paper: recognizing a hand-drawn treble, bass or C clef (alto or tenor), and
 * drawing a clean one in its place, sitting on the right staff line.
 *
 * Shapes are measured in staff gaps (the space between two staff lines), so recognition works
 * however large the clef was drawn relative to the staff.
 */

export type ClefKind = 'treble' | 'bass' | 'alto' | 'tenor'

export const CLEF_LABEL: Record<ClefKind, string> = {
  treble: 'Treble clef',
  bass: 'Bass clef',
  alto: 'Alto clef',
  tenor: 'Tenor clef',
}

/** Staff lines on music paper: the top line of each staff, and the gap between lines. */
export interface Staves {
  top: number
  gap: number
  pitch: number
  count: number
}

export interface ClefStroke {
  points: number[]
  widths: number[]
}

export interface DrawnStroke {
  points: readonly number[]
}

type Pt = readonly [number, number]

/*
 * Glyph centerlines in staff gaps, y downward, with (0, 0) on the clef's reference line: the G
 * line for treble, the F line for bass, the C line for alto and tenor. Each list is one stroke;
 * a single point is a round dot of the given width.
 */
const TREBLE: { points: Pt[]; dot?: number }[] = [
  {
    points: [
      // Hook at the foot, up the stem, over the top curl and down around the body to its center.
      [-0.62, 2.62],
      [-0.4, 2.98],
      [0.08, 3.0],
      [0.38, 2.62],
      [0.33, 1.5],
      [0.24, 0.3],
      [0.14, -1.0],
      [0.04, -2.3],
      [-0.06, -3.5],
      [0.02, -4.3],
      [0.22, -4.62],
      [0.48, -4.45],
      [0.62, -3.9],
      [0.5, -3.2],
      [0.12, -2.45],
      [-0.45, -1.75],
      [-0.95, -1.0],
      [-1.15, -0.1],
      [-0.88, 0.75],
      [-0.25, 1.15],
      [0.48, 1.1],
      [0.98, 0.6],
      [1.02, -0.12],
      [0.62, -0.62],
      [0.05, -0.62],
      [-0.32, -0.2],
      [-0.22, 0.25],
      [0.18, 0.3],
    ],
  },
  { points: [[-0.48, 2.42]], dot: 0.62 },
]

const BASS: { points: Pt[]; dot?: number }[] = [
  {
    points: [
      [0.05, 0.05],
      [0.2, -0.6],
      [0.75, -0.98],
      [1.35, -0.98],
      [1.85, -0.55],
      [2.0, 0.25],
      [1.75, 1.15],
      [1.1, 2.05],
      [0.05, 2.85],
    ],
  },
  { points: [[0.18, 0.08]], dot: 0.62 },
  { points: [[2.6, -0.5]], dot: 0.4 },
  { points: [[2.6, 0.5]], dot: 0.4 },
]

const C_CLEF: { points: Pt[]; dot?: number; width?: number }[] = [
  {
    points: [
      [0.0, -2.05],
      [0.0, 2.05],
    ],
    width: 0.5,
  },
  {
    points: [
      [0.58, -2.05],
      [0.58, 2.05],
    ],
    width: 0.16,
  },
  {
    points: [
      [1.3, -1.45],
      [1.55, -1.95],
      [2.05, -1.85],
      [2.25, -1.15],
      [1.95, -0.45],
      [1.4, -0.38],
      [1.05, -0.62],
      [0.8, -0.05],
    ],
  },
  {
    points: [
      [1.3, 1.45],
      [1.55, 1.95],
      [2.05, 1.85],
      [2.25, 1.15],
      [1.95, 0.45],
      [1.4, 0.38],
      [1.05, 0.62],
      [0.8, 0.05],
    ],
  },
  { points: [[1.32, -1.42]], dot: 0.42 },
  { points: [[1.32, 1.42]], dot: 0.42 },
]

const GLYPHS = { treble: TREBLE, bass: BASS, alto: C_CLEF, tenor: C_CLEF }

/** Which staff line, counted from the top (0 to 4), each clef sits on. */
const REFERENCE_LINE: Record<ClefKind, number> = { treble: 3, bass: 1, alto: 2, tenor: 1 }

/** The glyph's horizontal middle, in gaps, so the clean clef replaces the drawn one in place. */
function glyphMiddle(kind: ClefKind): number {
  const xs = GLYPHS[kind].flatMap((s) => s.points.map(([x]) => x))
  return (Math.min(...xs) + Math.max(...xs)) / 2
}

/**
 * A clean clef of `kind` on the staff whose top line is at `staffTop`, centered on `x`. Lines
 * are thick and thin like an engraved clef, from the fountain pen's nib.
 */
export function clefStrokes(
  kind: ClefKind,
  x: number,
  staffTop: number,
  gap: number,
  inkWidth: number,
): ClefStroke[] {
  const ox = x - glyphMiddle(kind) * gap
  const oy = staffTop + REFERENCE_LINE[kind] * gap
  return GLYPHS[kind].map((glyph) => {
    const points = glyph.points.flatMap(([px, py]) => [ox + px * gap, oy + py * gap])
    if (glyph.dot !== undefined) return { points, widths: [glyph.dot * gap] }
    if ('width' in glyph && glyph.width !== undefined) {
      return { points, widths: points.map(() => glyph.width! * gap) }
    }
    // Widths come from the nib along the curve itself, about one point apart.
    const flat = flattenStroke(
      points,
      points.map(() => 0),
    )
    const dense: number[] = []
    for (let i = 0; i < flat.length; i += 3) dense.push(flat[i]!, flat[i + 1]!)
    const pressures = new Array<number>(dense.length / 2).fill(0.5)
    const base = Math.max(inkWidth, gap * 0.32)
    const raw = pressures.map((_, i) => nibWidthAt(dense, pressures, base, i))
    return { points: dense, widths: raw.map((_, i) => smoothedValueAt(raw, i)) }
  })
}

// ---------- Recognition ----------

/** Bounds of several strokes together. */
function unionBounds(strokes: readonly DrawnStroke[]): Rect {
  return boundsOfPoints(strokes.flatMap((s) => s.points))
}

function pathLength(points: readonly number[]): number {
  let length = 0
  for (let i = 2; i < points.length; i += 2) {
    length += Math.hypot(points[i]! - points[i - 2]!, points[i + 1]! - points[i - 1]!)
  }
  return length
}

/** Evenly spaced points along a stroke, at most `count`. */
function resample(points: readonly number[], count: number): number[] {
  const n = points.length / 2
  if (n <= count) return [...points]
  const out: number[] = []
  for (let k = 0; k < count; k++) {
    const i = Math.round((k * (n - 1)) / (count - 1))
    out.push(points[i * 2]!, points[i * 2 + 1]!)
  }
  return out
}

function segmentsCross(p: readonly number[], i: number, j: number): boolean {
  const [ax, ay, bx, by] = [p[i * 2]!, p[i * 2 + 1]!, p[i * 2 + 2]!, p[i * 2 + 3]!]
  const [cx, cy, dx, dy] = [p[j * 2]!, p[j * 2 + 1]!, p[j * 2 + 2]!, p[j * 2 + 3]!]
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx)
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx)
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** How often a stroke crosses itself. */
export function selfCrossings(points: readonly number[]): number {
  const p = resample(points, 80)
  const n = p.length / 2
  let count = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) if (segmentsCross(p, i, j)) count++
  }
  return count
}

/** Turning points of the x coordinate: where a stroke stops going right and goes back left. */
function rightBumps(points: readonly number[], gap: number): number {
  const p = resample(points, 60)
  const step = gap * 0.3
  let bumps = 0
  // 1 while going right, -1 while going left; `ref` is the furthest point in that direction.
  let state = 0
  let ref = p[0]!
  for (let i = 2; i < p.length; i += 2) {
    const x = p[i]!
    if (state === 1) {
      if (x > ref) ref = x
      else if (ref - x > step) {
        bumps++
        state = -1
        ref = x
      }
    } else if (state === -1) {
      if (x < ref) ref = x
      else if (x - ref > step) {
        state = 1
        ref = x
      }
    } else if (Math.abs(x - ref) > step) {
      state = x > ref ? 1 : -1
      ref = x
    }
  }
  return bumps
}

/** The staff (0, 1, …) a page height is closest to, and its top line. */
export function nearestStaff(y: number, staves: Staves): { index: number; top: number } {
  const middle = staves.top + staves.gap * 2
  const index = Math.max(0, Math.min(staves.count - 1, Math.round((y - middle) / staves.pitch)))
  return { index, top: staves.top + index * staves.pitch }
}

/**
 * Recognizes a clef in a group of strokes drawn close together (the newest last). Returns the
 * clef and the staff it belongs to, or null.
 */
export function detectClef(
  strokes: readonly DrawnStroke[],
  staves: Staves,
): { kind: ClefKind; staffTop: number; x: number } | null {
  if (!strokes.length) return null
  const g = staves.gap
  const b = unionBounds(strokes)
  const h = b.maxY - b.minY
  const staff = nearestStaff((b.minY + b.maxY) / 2, staves)
  // The clef must overlap its staff.
  if (b.maxY < staff.top || b.minY > staff.top + 4 * g) return null
  const x = (b.minX + b.maxX) / 2
  const size = (s: DrawnStroke) => {
    const r = boundsOfPoints(s.points)
    return { w: r.maxX - r.minX, h: r.maxY - r.minY, r }
  }
  const dots = strokes.filter((s) => {
    const { w, h } = size(s)
    return Math.max(w, h) < 1.1 * g
  })
  const big = strokes.filter((s) => !dots.includes(s))
  if (!big.length) return null

  // Treble: one tall, looping stroke reaching above and below the staff.
  const tallest = big.reduce((a, s) => (size(s).h > size(a).h ? s : a))
  const t = size(tallest)
  if (
    t.h >= 4.2 * g &&
    t.h >= 1.6 * t.w &&
    pathLength(tallest.points) >= 2 * t.h &&
    selfCrossings(tallest.points) >= 2 &&
    big.length <= 2
  ) {
    return { kind: 'treble', staffTop: staff.top, x }
  }

  // C clef: a vertical bar with a double curve (or two curves) to its right.
  const bars = big.filter((s) => {
    const { w, h } = size(s)
    return h >= 2.4 * g && h >= 3.5 * Math.max(w, 0.1)
  })
  if (bars.length) {
    const barX = Math.max(...bars.map((s) => size(s).r.maxX))
    const curves = big.filter((s) => !bars.includes(s) && size(s).r.minX >= barX - g * 0.6)
    const bumps = curves.reduce((n, s) => n + rightBumps(s.points, g), 0)
    const curveHeight = curves.length ? unionBounds(curves).maxY - unionBounds(curves).minY : 0
    if (bumps >= 2 && curveHeight >= 2.2 * g && h <= 6.5 * g) {
      // The notch between the curves marks the C line: the middle line (alto) or the fourth
      // from the bottom (tenor).
      const middle = (b.minY + b.maxY) / 2
      const line = Math.round((middle - staff.top) / g)
      return { kind: line <= 1 ? 'tenor' : 'alto', staffTop: staff.top, x }
    }
  }

  // Bass: an open hook with two dots to its right.
  if (big.length === 1 && dots.length >= 2) {
    const hook = size(big[0]!)
    const pts = big[0]!.points
    const n = pts.length / 2
    const open = Math.hypot(pts[0]! - pts[(n - 1) * 2]!, pts[1]! - pts[(n - 1) * 2 + 1]!)
    const rightDots = dots.filter((d) => {
      const r = size(d).r
      const cx = (r.minX + r.maxX) / 2
      const cy = (r.minY + r.maxY) / 2
      return cx > hook.r.minX + hook.w * 0.55 && cy < hook.r.minY + hook.h * 0.75
    })
    if (
      hook.h >= 1.6 * g &&
      hook.h <= 6 * g &&
      hook.w >= 0.8 * g &&
      open >= 0.5 * hook.h &&
      rightDots.length >= 2
    ) {
      return { kind: 'bass', staffTop: staff.top, x }
    }
  }
  return null
}
