import { boundsOfPoints, intersects, type Rect } from '../geometry/rect.ts'
import { objectBounds } from '../render/objects.ts'
import {
  chainThrough,
  insidePolygon,
  recognizeShape,
  regionAt,
  toPts,
  type OutlineSource,
  type Region,
  type Shape,
} from '../geometry/shapes.ts'
import { detectTable } from '../geometry/tableDetect.ts'
import { withPoints } from '../model/factory.ts'
import { newId } from '../model/ids.ts'
import { DEFAULT_TABLE_STYLE, tableFromGrid } from '../model/table.ts'
import type { CanvasObject, FillObject, Id, PaperKind, StrokeObject } from '../model/types.ts'
import { PAPER_STYLE } from '../render/paper.ts'
import {
  CLEF_LABEL,
  clefStrokes,
  detectClef,
  type ClefKind,
  type ClefStroke,
  type Staves,
} from '../geometry/clefs.ts'
import { PAGE_SIZE } from '../model/types.ts'
import { detectArrow, type CleanArrow } from '../geometry/arrows.ts'
import { detectGraph } from '../geometry/graphs.ts'
import { perfectLine } from '../geometry/perfect.ts'

/** Strokes smaller than this (in points) are handwriting, not shapes. */
const MIN_SHAPE_SIZE = 36
/** Share of a stroke's points that must lie inside an outline for it to count as coloring in. */
const INSIDE_SHARE = 0.85

export type Suggestion =
  /** The first stroke becomes the shape; the others (sides drawn separately) are removed. */
  | { kind: 'shape'; strokeIds: Id[]; shape: Shape }
  | { kind: 'fill'; region: Region; color: string; opacity: number; removeIds: Id[] }
  /** Hand-drawn grid lines become a table with the same spacing. */
  | { kind: 'table'; strokeIds: Id[]; xs: number[]; ys: number[]; color: string; width: number }
  /** A hand-drawn clef on music paper becomes a clean one on its staff line. */
  | { kind: 'clef'; strokeIds: Id[]; clef: ClefKind; strokes: ClefStroke[] }

/** The strokes a suggestion changes or relies on. */
export function suggestionIds(s: Suggestion): Id[] {
  if (s.kind === 'fill') return [...s.region.sourceIds, ...s.removeIds]
  return s.strokeIds
}

/** The page area a suggestion is about, for placing the offer next to it. */
export function suggestionBounds(s: Suggestion): Rect {
  if (s.kind === 'fill') return boundsOfPoints(s.region.points)
  if (s.kind === 'shape') return boundsOfPoints(s.shape.points)
  if (s.kind === 'clef') return boundsOfPoints(s.strokes.flatMap((c) => c.points))
  return {
    minX: s.xs[0]!,
    minY: s.ys[0]!,
    maxX: s.xs[s.xs.length - 1]!,
    maxY: s.ys[s.ys.length - 1]!,
  }
}

export function suggestionLabel(s: Suggestion): string {
  if (s.kind === 'fill') return 'Auto fill'
  if (s.kind === 'shape') return `Auto shape · ${s.shape.label}`
  if (s.kind === 'clef') return `Clean clef · ${CLEF_LABEL[s.clef]}`
  return `Auto table · ${s.ys.length - 1} × ${s.xs.length - 1}`
}

/** Strokes shorter than this rarely outline an area; skipping them keeps the search fast. */
const MIN_OUTLINE_SIZE = 12
/** At most this many nearby strokes are tried as outlines. */
const MAX_OUTLINES = 80

/**
 * The strokes of one layer near `around`, as outlines that can enclose an area. Only nearby
 * strokes can enclose something there, and handwriting pages hold hundreds of strokes.
 */
export function outlineSources(
  objects: readonly CanvasObject[],
  layerId: Id,
  around: Rect,
  except?: Id,
): OutlineSource[] {
  const out: OutlineSource[] = []
  for (const o of objects) {
    if (o.type !== 'stroke' || o.tool === 'tape' || o.layerId !== layerId || o.id === except)
      continue
    const b = objectBounds(o)
    if (!intersects(b, around)) continue
    if (Math.max(b.maxX - b.minX, b.maxY - b.minY) < MIN_OUTLINE_SIZE) continue
    out.push({ id: o.id, points: o.points, closed: o.closed, straight: o.straight })
    if (out.length >= MAX_OUTLINES) break
  }
  return out
}

/** A square of `reach` points around a spot. */
export function around(x: number, y: number, reach: number): Rect {
  return { minX: x - reach, minY: y - reach, maxX: x + reach, maxY: y + reach }
}

function shareInside(points: readonly number[], region: Region): number {
  const outline = toPts(region.points)
  let inside = 0
  for (let i = 0; i < points.length; i += 2) {
    if (insidePolygon(points[i]!, points[i + 1]!, outline)) inside++
  }
  return inside / (points.length / 2)
}

/**
 * What to offer after a stroke was drawn: filling the shape it colors in, or turning it into a
 * clean shape. Coloring in wins, since a scribble inside a circle is rarely meant as a shape.
 */
export function suggestFor(
  objects: readonly CanvasObject[],
  stroke: StrokeObject,
  /** Only look for a table, e.g. after a line that was already made perfectly straight. */
  tableOnly = false,
  /** The page's paper: on music paper, clefs are recognized. */
  paper?: PaperKind,
): Suggestion | null {
  if (paper === 'music' && !tableOnly) {
    const clef = clefFor(objects, stroke)
    if (clef) return clef
  }
  const pts = stroke.points
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i += 2) {
    cx += pts[i]!
    cy += pts[i + 1]!
  }
  cx /= pts.length / 2
  cy /= pts.length / 2

  const sb = boundsOfPoints(pts)
  const reach = Math.max(sb.maxX - sb.minX, sb.maxY - sb.minY) + 120

  // Straight lines that complete a grid offer a table.
  const table = detectTable(
    outlineSources(objects, stroke.layerId, around(cx, cy, reach + 200)),
    stroke.id,
  )
  if (table) {
    const ids = objects.filter((o) => table.ids.includes(o.id)).map((o) => o.id)
    return {
      kind: 'table',
      strokeIds: ids,
      xs: table.xs,
      ys: table.ys,
      color: stroke.color,
      width: stroke.width,
    }
  }
  if (tableOnly) return null

  const region = regionAt(
    outlineSources(objects, stroke.layerId, around(cx, cy, reach), stroke.id),
    cx,
    cy,
  )
  if (region) {
    const b = boundsOfPoints(pts)
    const covers = ((b.maxX - b.minX) * (b.maxY - b.minY)) / region.area
    if (shareInside(pts, region) >= INSIDE_SHARE && covers >= 0.1) {
      // Earlier scribbles in the same color inside the same shape are replaced too.
      const removeIds = objects.flatMap((o) =>
        o.type === 'stroke' &&
        o.layerId === stroke.layerId &&
        o.color === stroke.color &&
        !region.sourceIds.includes(o.id) &&
        (o.id === stroke.id || shareInside(o.points, region) >= INSIDE_SHARE)
          ? [o.id]
          : [],
      )
      return { kind: 'fill', region, color: stroke.color, opacity: stroke.opacity, removeIds }
    }
  }

  // A stroke that closes a figure drawn side by side (a square from four lines) offers that
  // figure as one shape.
  const sources = outlineSources(objects, stroke.layerId, around(cx, cy, reach))
  const chain = chainThrough(sources, stroke.id)
  if (chain) {
    const shape = recognizeShape(chain.points)
    // Keep the drawing order: the earliest side becomes the shape.
    const ids = objects.filter((o) => chain.ids.includes(o.id)).map((o) => o.id)
    if (shape?.closed) return { kind: 'shape', strokeIds: ids, shape }
  }

  const b = boundsOfPoints(pts)
  if (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) < MIN_SHAPE_SIZE) return null
  const shape = recognizeShape(pts)
  return shape ? { kind: 'shape', strokeIds: [stroke.id], shape } : null
}

/**
 * The newest strokes near `stroke` (itself first), at most `max`, drawn one after another with
 * the pen on its layer: parts of one drawing, like an arrow's shaft and head.
 */
function recentNear(
  objects: readonly CanvasObject[],
  stroke: StrokeObject,
  max: number,
  margin: { x: number; y: number },
): StrokeObject[] {
  const recent: StrokeObject[] = []
  let area = boundsOfPoints(stroke.points)
  for (let i = objects.length - 1; i >= 0 && recent.length < max; i--) {
    const o = objects[i]!
    if (o.type !== 'stroke' || o.layerId !== stroke.layerId || o.tool !== 'pen') continue
    const b = boundsOfPoints(o.points)
    const near = {
      minX: area.minX - margin.x,
      minY: area.minY - margin.y,
      maxX: area.maxX + margin.x,
      maxY: area.maxY + margin.y,
    }
    if (o.id !== stroke.id && !intersects(b, near)) break
    recent.push(o)
    area = {
      minX: Math.min(area.minX, b.minX),
      minY: Math.min(area.minY, b.minY),
      maxX: Math.max(area.maxX, b.maxX),
      maxY: Math.max(area.maxY, b.maxY),
    }
  }
  return recent[0]?.id === stroke.id ? recent : []
}

/** A drawing made clean: what replaces which strokes, and the name of the step for undo. */
export interface CleanDrawing {
  label: string
  strokes: StrokeObject[]
  replaces: Id[]
}

/**
 * Graph axes or an arrow drawn with `stroke`, alone or with up to two strokes just before it
 * (axes, or a shaft, then the head). With the pen this is only asked for when the pen is held
 * still at the end of a stroke: guessing after every stroke found arrows in ordinary handwriting.
 */
export function cleanDrawingFor(
  objects: readonly CanvasObject[],
  stroke: StrokeObject,
): CleanDrawing | null {
  if (stroke.tool !== 'pen' || stroke.closed) return null
  const recent = recentNear(objects, stroke, 3, { x: 4, y: 4 })
  for (let k = recent.length; k >= 2; k--) {
    const graph = detectGraph(recent.slice(0, k).reverse())
    if (graph) {
      const ink = cleanInk(stroke)
      return {
        label: 'Graph',
        strokes: graph.lines.map((points) => ({ ...ink, id: newId(), points, straight: true })),
        replaces: graph.ids,
      }
    }
  }
  for (let k = recent.length; k >= 1; k--) {
    const arrow = detectArrow(recent.slice(0, k).reverse())
    if (arrow) return { label: 'Arrow', strokes: arrowStrokes(stroke, arrow), replaces: arrow.ids }
  }
  return null
}

/** The look of a stroke without its drawn shape (points, widths, input, dashes). */
function cleanInk(like: StrokeObject): Omit<StrokeObject, 'id' | 'points'> {
  const {
    id: _id,
    points: _points,
    path: _path,
    closed: _closed,
    widths: _widths,
    input: _input,
    dash: _dash,
    straight: _straight,
    ...ink
  } = like
  return ink
}

/** The strokes of a clean arrow in the style of `like`: the shaft, then an even head. */
function arrowStrokes(like: StrokeObject, arrow: CleanArrow): StrokeObject[] {
  const ink = cleanInk(like)
  // A dashed shaft stays dashed; the head is always solid.
  return [
    {
      ...ink,
      ...(like.dash ? { dash: like.dash } : {}),
      id: newId(),
      points: arrow.shaft,
      straight: arrow.straight,
    },
    { ...ink, id: newId(), points: arrow.head, straight: true },
  ]
}

/** Puts `strokes` where the first of `replaces` was, without the replaced ones. */
export function replaceStrokes(
  objects: readonly CanvasObject[],
  replaces: readonly Id[],
  strokes: readonly CanvasObject[],
): CanvasObject[] {
  const gone = new Set(replaces)
  const at = objects.findIndex((o) => gone.has(o.id))
  const kept = objects.filter((o) => !gone.has(o.id))
  kept.splice(at < 0 ? kept.length : Math.min(at, kept.length), 0, ...strokes)
  return kept
}

/**
 * The magic pen: what the page becomes once `stroke` (already on it, last) is made perfect.
 * Graph axes and arrows become clean ones, coloring in a shape fills it, shapes and tables
 * become clean ones, and anything else is smoothed, keeping its size and proportions.
 */
export function magicFor(
  objects: readonly CanvasObject[],
  stroke: StrokeObject,
  paper?: PaperKind,
): { label: string; objects: CanvasObject[] } {
  const drawing = cleanDrawingFor(objects, stroke)
  if (drawing) {
    return {
      label: drawing.label,
      objects: replaceStrokes(objects, drawing.replaces, drawing.strokes),
    }
  }
  const suggestion = suggestFor(objects, stroke, false, paper)
  if (suggestion) {
    return {
      label: suggestionLabel(suggestion).split(' · ')[0]!.replace('Auto ', 'Magic '),
      objects: applySuggestion(objects, suggestion, stroke.layerId, newId),
    }
  }
  const smooth: StrokeObject = {
    ...cleanInk(stroke),
    ...(stroke.dash ? { dash: stroke.dash } : {}),
    id: stroke.id,
    points: stroke.closed ? stroke.points : perfectLine(stroke.points),
    straight: true,
  }
  return { label: 'Magic pen', objects: objects.map((o) => (o.id === stroke.id ? smooth : o)) }
}

/** The staves on music paper. */
export const MUSIC_STAVES: Staves = (() => {
  const m = PAPER_STYLE.music
  let count = 0
  while (m.top + count * m.pitch + 4 * m.gap <= PAGE_SIZE.height - m.bottom) count++
  return { top: m.top, gap: m.gap, pitch: m.pitch, count }
})()

/** How many of the latest strokes are looked at together for a clef (a bass clef has three). */
const CLEF_GROUP = 6

/**
 * A clef drawn with the latest stroke: the newest strokes close to it are tried together, the
 * most of them first, so a clef drawn in parts (a hook, then two dots) is found as a whole.
 */
function clefFor(objects: readonly CanvasObject[], stroke: StrokeObject): Suggestion | null {
  const g = MUSIC_STAVES.gap
  const recent = recentNear(objects, stroke, CLEF_GROUP, { x: 3 * g, y: 4 * g })
  if (!recent.length) return null
  for (let k = recent.length; k >= 1; k--) {
    const group = recent.slice(0, k).reverse()
    const found = detectClef(group, MUSIC_STAVES)
    if (!found) continue
    return {
      kind: 'clef',
      strokeIds: group.map((s) => s.id),
      clef: found.kind,
      strokes: clefStrokes(found.kind, found.x, found.staffTop, g, stroke.width),
    }
  }
  return null
}

export function fillFor(
  region: Region,
  color: string,
  opacity: number,
  layerId: Id,
  id: Id,
): FillObject {
  return { id, type: 'fill', layerId, color, opacity, points: region.points, smooth: region.smooth }
}

/** Adds a fill right below the strokes that outline it, so the outline stays on top. */
export function insertBelow(
  objects: readonly CanvasObject[],
  fill: FillObject,
  outlineIds: readonly Id[],
): CanvasObject[] {
  const index = objects.findIndex((o) => outlineIds.includes(o.id))
  const out = [...objects]
  out.splice(index < 0 ? objects.length : index, 0, fill)
  return out
}

/** The page's objects after accepting a suggestion. */
export function applySuggestion(
  objects: readonly CanvasObject[],
  suggestion: Suggestion,
  layerId: Id,
  newId: () => Id,
): CanvasObject[] {
  if (suggestion.kind === 'table') {
    const { xs, ys, color, width, strokeIds } = suggestion
    const table = tableFromGrid(newId(), layerId, xs, ys, {
      ...DEFAULT_TABLE_STYLE,
      lineColor: color,
      textColor: color,
      lineWidth: width,
    })
    // The table takes the place of its first line in the drawing order.
    const at = objects.findIndex((o) => strokeIds.includes(o.id))
    const kept = objects.filter((o) => !strokeIds.includes(o.id))
    kept.splice(Math.max(0, Math.min(at, kept.length)), 0, table)
    return kept
  }
  if (suggestion.kind === 'clef') {
    const { strokeIds } = suggestion
    const first = objects.find((o) => o.id === strokeIds[strokeIds.length - 1])
    if (first?.type !== 'stroke') return [...objects]
    const {
      path: _path,
      closed: _closed,
      straight: _straight,
      dash: _dash,
      input: _input,
      ...ink
    } = first
    const clean: StrokeObject[] = suggestion.strokes.map((c) => ({
      ...ink,
      id: newId(),
      points: c.points,
      widths: c.widths,
    }))
    // The clean clef takes the place of the first drawn part.
    const at = objects.findIndex((o) => strokeIds.includes(o.id))
    const kept = objects.filter((o) => !strokeIds.includes(o.id))
    kept.splice(Math.max(0, Math.min(at, kept.length)), 0, ...clean)
    return kept
  }
  if (suggestion.kind === 'shape') {
    const { shape, strokeIds } = suggestion
    const [keep, ...drop] = strokeIds
    return objects.flatMap((o) => {
      if (drop.includes(o.id)) return []
      if (o.id === keep && o.type === 'stroke') {
        return [{ ...withPoints(o, shape.points), closed: shape.closed, straight: shape.straight }]
      }
      return [o]
    })
  }
  const fill = fillFor(suggestion.region, suggestion.color, suggestion.opacity, layerId, newId())
  const kept = objects.filter((o) => !suggestion.removeIds.includes(o.id))
  return insertBelow(kept, fill, suggestion.region.sourceIds)
}
