import { formatAll, scaleText } from '../model/richText.ts'
import { boxCenter, boxContains, boxCorners, isBox } from '../geometry/box.ts'
import { strokeTouchesCircle } from '../geometry/erase.ts'
import { union, type Rect } from '../geometry/rect.ts'
import { fillBaseColor, type Fill } from '../model/fill.ts'
import type { CanvasObject, FillObject, Outline, StrokeObject, TextObject } from '../model/types.ts'
import { objectBounds } from '../render/objects.ts'
import { layoutText, textCenter, textContains, textCorners } from '../render/text.ts'

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
 * Whether the lasso catches an object. Touching is enough: any part of a stroke inside the loop,
 * or any part of a text box (a corner, its middle, or a loop drawn inside the box).
 */
export function lassoCatches(object: CanvasObject, poly: Polygon): boolean {
  if (object.type === 'text') {
    const c = textCenter(object)
    if (pointInPolygon(c.x, c.y, poly)) return true
    if (textCorners(object).some((p) => pointInPolygon(p.x, p.y, poly))) return true
    return poly.length >= 2 && textContains(object, poly[0]!, poly[1]!)
  }
  if (isBox(object)) {
    const c = boxCenter(object)
    if (pointInPolygon(c.x, c.y, poly)) return true
    const corners = boxCorners(object)
    if (corners.some((p) => pointInPolygon(p.x, p.y, poly))) return true
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!
      const b = corners[(i + 1) % 4]!
      if (segmentCrossesPolygon(a.x, a.y, b.x, b.y, poly)) return true
    }
    return poly.length >= 2 && boxContains(object, poly[0]!, poly[1]!)
  }
  const pts = object.points
  for (let i = 0; i < pts.length; i += 2) {
    if (pointInPolygon(pts[i]!, pts[i + 1]!, poly)) return true
  }
  // A loop drawn inside a filled area catches that area.
  if (object.type === 'fill' && poly.length >= 2 && pointInPolygon(poly[0]!, poly[1]!, pts)) {
    return true
  }
  // A thin loop can pass between two samples of a long straight segment.
  for (let i = 0; i + 3 < pts.length; i += 2) {
    if (segmentCrossesPolygon(pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, poly)) return true
  }
  return false
}

function segmentCrossesPolygon(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  poly: Polygon,
): boolean {
  const n = poly.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (
      segmentsIntersect(
        ax,
        ay,
        bx,
        by,
        poly[j * 2]!,
        poly[j * 2 + 1]!,
        poly[i * 2]!,
        poly[i * 2 + 1]!,
      )
    ) {
      return true
    }
  }
  return false
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const cross = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) =>
    (qx - px) * (ry - py) - (qy - py) * (rx - px)
  const d1 = cross(cx, cy, dx, dy, ax, ay)
  const d2 = cross(cx, cy, dx, dy, bx, by)
  const d3 = cross(ax, ay, bx, by, cx, cy)
  const d4 = cross(ax, ay, bx, by, dx, dy)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** The same object with a contour around it, or without one. */
export function withOutline(object: CanvasObject, outline: Outline | null): CanvasObject {
  const { outline: _old, ...rest } = object
  return outline ? { ...rest, outline } : rest
}

/** The same object in another color: the ink of a stroke or fill, the text of a text box. */
export function recolor(object: CanvasObject, color: string): CanvasObject {
  if (object.type === 'text') return withoutGradient(formatAll(object, { color }))
  // A table takes the color for its lines; pictures keep their own colors.
  if (object.type === 'table') return { ...object, style: { ...object.style, lineColor: color } }
  if (isBox(object)) return object
  return withoutGradient({ ...object, color })
}

function withoutGradient<T extends CanvasObject>(object: T): T {
  if (!('gradient' in object)) return object
  const { gradient: _gradient, ...rest } = object
  return rest as T
}

/** Whether an object can be painted with a gradient: ink, filled areas and text. */
export function takesGradient(object: CanvasObject): boolean {
  return object.type === 'stroke' || object.type === 'fill' || object.type === 'text'
}

/**
 * Paints an object with a color or a gradient. A gradient keeps its first color as the
 * object's plain color, used where a single color is needed; objects that cannot show a
 * gradient take that color.
 */
export function repaint(object: CanvasObject, fill: Fill): CanvasObject {
  if (fill.type === 'solid') return recolor(object, fill.color)
  const base = fillBaseColor(fill)
  if (!takesGradient(object)) return recolor(object, base)
  const colored = recolor(object, base) as StrokeObject | FillObject | TextObject
  return { ...colored, gradient: fill }
}

/** Whether a tap at (x, y) with the given tolerance lands on the object. */
export function hitsObject(object: CanvasObject, x: number, y: number, slop: number): boolean {
  if (object.type === 'text') return textContains(object, x, y, slop)
  if (object.type === 'fill') return pointInPolygon(x, y, object.points)
  if (isBox(object)) return boxContains(object, x, y, slop)
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
  const moved = transformShape(object, t)
  if (!object.outline || t.scale === 1) return moved
  return { ...moved, outline: { ...object.outline, width: object.outline.width * t.scale } }
}

function transformShape(object: CanvasObject, t: Transform): CanvasObject {
  if (isBox(object)) {
    const c = transformPoint(t, object.x + object.width / 2, object.y + object.height / 2)
    const width = object.width * t.scale
    const height = object.height * t.scale
    const frame = {
      x: c.x - width / 2,
      y: c.y - height / 2,
      width,
      height,
      rotation: normalizeAngle(object.rotation + t.angle),
    }
    if (t.scale === 1 || object.type === 'image') return { ...object, ...frame }
    if (object.type === 'chart') return { ...object, ...frame, fontSize: object.fontSize * t.scale }
    // A table grows as a whole: its spacing, lines and text.
    return {
      ...object,
      ...frame,
      columns: object.columns.map((w) => w * t.scale),
      rows: object.rows.map((h) => h * t.scale),
      style: {
        ...object.style,
        lineWidth: object.style.lineWidth * t.scale,
        fontSize: object.style.fontSize * t.scale,
      },
    }
  }
  if (object.type !== 'text') {
    const points: number[] = []
    for (let i = 0; i < object.points.length; i += 2) {
      const p = transformPoint(t, object.points[i]!, object.points[i + 1]!)
      points.push(p.x, p.y)
    }
    if (object.type === 'fill') return { ...object, points }
    const moved = { ...object, points, width: object.width * t.scale }
    if (object.path) moved.path = mapPairs(object.path, (x, y) => transformPoint(t, x, y))
    return moved
  }
  const center = textCenter(object)
  const c = transformPoint(t, center.x, center.y)
  const resized: TextObject = {
    ...scaleText(object, t.scale),
    width: object.width * t.scale,
    rotation: normalizeAngle(object.rotation + t.angle),
  }
  const { height } = layoutText(resized)
  return { ...resized, x: c.x - resized.width / 2, y: c.y - height / 2 }
}

/**
 * Mirrors an object across a vertical (horizontal flip) or horizontal line through (cx, cy).
 * Text boxes move to their mirrored place but their text stays readable.
 */
export function flipObject(
  object: CanvasObject,
  axis: 'horizontal' | 'vertical',
  cx: number,
  cy: number,
): CanvasObject {
  const fx = (x: number) => (axis === 'horizontal' ? 2 * cx - x : x)
  const fy = (y: number) => (axis === 'vertical' ? 2 * cy - y : y)
  if (isBox(object)) {
    // A box moves to its mirrored position; a picture is also mirrored in place, while a
    // table stays readable.
    const c = boxCenter(object)
    const moved = {
      ...object,
      x: fx(c.x) - object.width / 2,
      y: fy(c.y) - object.height / 2,
      rotation: normalizeAngle(-object.rotation),
    }
    if (moved.type === 'table') {
      // A table is mirrored by reversing its columns or rows; its text stays readable.
      if (axis === 'horizontal') {
        return {
          ...moved,
          columns: [...moved.columns].reverse(),
          cells: moved.cells.map((row) => [...row].reverse()),
        }
      }
      return { ...moved, rows: [...moved.rows].reverse(), cells: [...moved.cells].reverse() }
    }
    if (moved.type === 'chart') {
      if (axis === 'vertical') return moved
      return {
        ...moved,
        labels: [...moved.labels].reverse(),
        series: moved.series.map((s) => ({ ...s, values: [...s.values].reverse() })),
      }
    }
    return {
      ...moved,
      flipX: axis === 'horizontal' ? !moved.flipX : moved.flipX,
      flipY: axis === 'vertical' ? !moved.flipY : moved.flipY,
    }
  }
  if (object.type !== 'text') {
    const points: number[] = []
    for (let i = 0; i < object.points.length; i += 2) {
      points.push(fx(object.points[i]!), fy(object.points[i + 1]!))
    }
    if (object.type === 'fill' || !object.path) return { ...object, points }
    return { ...object, points, path: mapPairs(object.path, (x, y) => ({ x: fx(x), y: fy(y) })) }
  }
  const c = textCenter(object)
  const { height } = layoutText(object)
  return {
    ...object,
    x: fx(c.x) - object.width / 2,
    y: fy(c.y) - height / 2,
    rotation: normalizeAngle(-object.rotation),
  }
}

function mapPairs(
  flat: readonly number[],
  fn: (x: number, y: number) => { x: number; y: number },
): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const p = fn(flat[i]!, flat[i + 1]!)
    out.push(p.x, p.y)
  }
  return out
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
