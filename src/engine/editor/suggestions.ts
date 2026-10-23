import { boundsOfPoints } from '../geometry/rect.ts'
import {
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
  | { kind: 'shape'; strokeId: Id; shape: Shape }
  | { kind: 'fill'; region: Region; color: string; opacity: number; removeIds: Id[] }

/** The strokes of one layer, as outlines that can enclose an area. */
export function outlineSources(
  objects: readonly CanvasObject[],
  layerId: Id,
  except?: Id,
): OutlineSource[] {
  return objects.flatMap((o) =>
    o.type === 'stroke' && o.layerId === layerId && o.id !== except
      ? [{ id: o.id, points: o.points, closed: o.closed, straight: o.straight }]
      : [],
  )
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

  const region = regionAt(outlineSources(objects, stroke.layerId, stroke.id), cx, cy)
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

  const b = boundsOfPoints(pts)
  if (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) < MIN_SHAPE_SIZE) return null
  const shape = recognizeShape(pts)
  return shape ? { kind: 'shape', strokeId: stroke.id, shape } : null
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
    const { shape } = suggestion
    return objects.map((o) =>
      o.id === suggestion.strokeId && o.type === 'stroke'
        ? { ...o, points: shape.points, closed: shape.closed, straight: shape.straight }
        : o,
    )
  }
  const fill = fillFor(suggestion.region, suggestion.color, suggestion.opacity, layerId, newId())
  const kept = objects.filter((o) => !suggestion.removeIds.includes(o.id))
  return insertBelow(kept, fill, suggestion.region.sourceIds)
}
