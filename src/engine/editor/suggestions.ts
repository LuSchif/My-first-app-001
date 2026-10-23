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
import type { CanvasObject, FillObject, Id, StrokeObject } from '../model/types.ts'

/** Strokes smaller than this (in points) are handwriting, not shapes. */
const MIN_SHAPE_SIZE = 36
/** Share of a stroke's points that must lie inside an outline for it to count as coloring in. */
const INSIDE_SHARE = 0.85

export type Suggestion =
  /** The first stroke becomes the shape; the others (sides drawn separately) are removed. */
  | { kind: 'shape'; strokeIds: Id[]; shape: Shape }
  | { kind: 'fill'; region: Region; color: string; opacity: number; removeIds: Id[] }

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
    if (o.type !== 'stroke' || o.layerId !== layerId || o.id === except) continue
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
): Suggestion | null {
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
  if (suggestion.kind === 'shape') {
    const { shape, strokeIds } = suggestion
    const [keep, ...drop] = strokeIds
    return objects.flatMap((o) => {
      if (drop.includes(o.id)) return []
      if (o.id === keep && o.type === 'stroke') {
        return [{ ...o, points: shape.points, closed: shape.closed, straight: shape.straight }]
      }
      return [o]
    })
  }
  const fill = fillFor(suggestion.region, suggestion.color, suggestion.opacity, layerId, newId())
  const kept = objects.filter((o) => !suggestion.removeIds.includes(o.id))
  return insertBelow(kept, fill, suggestion.region.sourceIds)
}
