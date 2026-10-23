import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { traceStroke } from '../geometry/strokePath.ts'
import type { StrokeObject } from '../model/types.ts'

// Objects are immutable, so derived data can be cached per object for its whole life.
const paths = new WeakMap<StrokeObject, Path2D>()
const bounds = new WeakMap<StrokeObject, Rect>()

export function strokePath(stroke: StrokeObject): Path2D {
  let path = paths.get(stroke)
  if (!path) {
    path = new Path2D()
    traceStroke(path, stroke.points)
    paths.set(stroke, path)
  }
  return path
}

/** Bounds including the line width. */
export function strokeBounds(stroke: StrokeObject): Rect {
  let rect = bounds.get(stroke)
  if (!rect) {
    rect = boundsOfPoints(stroke.points, stroke.width / 2)
    bounds.set(stroke, rect)
  }
  return rect
}

export function setInkStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<StrokeObject, 'width' | 'color'>,
): void {
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
}

export function paintStroke(ctx: CanvasRenderingContext2D, stroke: StrokeObject): void {
  setInkStyle(ctx, stroke)
  ctx.globalAlpha = stroke.opacity
  // Highlighter tints what is below instead of covering it, like a real marker.
  ctx.globalCompositeOperation = stroke.tool === 'highlighter' ? 'multiply' : 'source-over'
  ctx.stroke(strokePath(stroke))
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
