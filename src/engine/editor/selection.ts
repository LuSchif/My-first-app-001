import { strokeTouchesCircle } from '../geometry/erase.ts'
import { union, type Rect } from '../geometry/rect.ts'
import type { CanvasObject, TextObject } from '../model/types.ts'
import { objectBounds } from '../render/objects.ts'
import { layoutText, textCenter, textContains } from '../render/text.ts'

type Polygon = readonly number[]

export function pointInPolygon(x: number, y: number, poly: Polygon): boolean {
  let inside = false
  const n = poly.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2]!
    const yi = poly[i * 2 + 1]!
    const xj = poly[j * 2]!
    const yj = poly[j * 2 + 1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Whether the lasso catches an object: most of a stroke's points, or the middle of a text box.
 * "Most" rather than "all" forgives a lasso that clips the tail of a letter.
 */
export function lassoCatches(object: CanvasObject, poly: Polygon): boolean {
  if (object.type === 'text') {
    const c = textCenter(object)
    return pointInPolygon(c.x, c.y, poly)
  }
  const n = object.points.length / 2
  let inside = 0
  for (let i = 0; i < n; i++) {
    if (pointInPolygon(object.points[i * 2]!, object.points[i * 2 + 1]!, poly)) inside++
  }
  return inside / n >= 0.5
}

/** Whether a tap at (x, y) with the given tolerance lands on the object. */
export function hitsObject(object: CanvasObject, x: number, y: number, slop: number): boolean {
  if (object.type === 'text') return textContains(object, x, y, slop)
  return strokeTouchesCircle(object.points, x, y, object.width / 2 + slop)
}

export function boundsOf(objects: readonly CanvasObject[]): Rect | null {
  let rect: Rect | null = null
  for (const object of objects) rect = union(rect, objectBounds(object))
  return rect
}

/** Move, uniform scale and rotation around a center, in page coordinates. */
export interface Transform {
  cx: number
  cy: number
  dx: number
  dy: number
  scale: number
  angle: number
}

export const IDENTITY: Omit<Transform, 'cx' | 'cy'> = { dx: 0, dy: 0, scale: 1, angle: 0 }

export function transformPoint(t: Transform, x: number, y: number): { x: number; y: number } {
  const cos = Math.cos(t.angle)
  const sin = Math.sin(t.angle)
  const px = (x - t.cx) * t.scale
  const py = (y - t.cy) * t.scale
  return { x: t.cx + px * cos - py * sin + t.dx, y: t.cy + px * sin + py * cos + t.dy }
}

/** Applies a transform permanently: strokes get new points, text boxes a new frame and size. */
export function transformObject(object: CanvasObject, t: Transform): CanvasObject {
  if (object.type === 'stroke') {
    const points: number[] = []
    for (let i = 0; i < object.points.length; i += 2) {
      const p = transformPoint(t, object.points[i]!, object.points[i + 1]!)
      points.push(p.x, p.y)
    }
    return { ...object, points, width: object.width * t.scale }
  }
  const center = textCenter(object)
  const c = transformPoint(t, center.x, center.y)
  const resized: TextObject = {
    ...object,
    width: object.width * t.scale,
    rotation: normalizeAngle(object.rotation + t.angle),
    style: { ...object.style, size: object.style.size * t.scale },
  }
  const { height } = layoutText(resized)
  return { ...resized, x: c.x - resized.width / 2, y: c.y - height / 2 }
}

/** The selection frame corners after a transform, for drawing the rotated outline. */
export function transformRect(t: Transform, r: Rect): { x: number; y: number }[] {
  return [
    transformPoint(t, r.minX, r.minY),
    transformPoint(t, r.maxX, r.minY),
    transformPoint(t, r.maxX, r.maxY),
    transformPoint(t, r.minX, r.maxY),
  ]
}

function normalizeAngle(a: number): number {
  const full = Math.PI * 2
  return ((((a + Math.PI) % full) + full) % full) - Math.PI
}
