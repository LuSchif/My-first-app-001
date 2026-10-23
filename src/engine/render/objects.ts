import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { traceStroke } from '../geometry/strokePath.ts'
import type { CanvasObject, FillObject } from '../model/types.ts'
import { paintStroke, strokeBounds } from './strokes.ts'
import { paintText, textBounds } from './text.ts'

const fillPaths = new WeakMap<FillObject, Path2D>()
const fillBounds = new WeakMap<FillObject, Rect>()

export function fillPath(fill: FillObject): Path2D {
  let path = fillPaths.get(fill)
  if (!path) {
    path = new Path2D()
    traceStroke(path, fill.points, { closed: true, straight: !fill.smooth })
    fillPaths.set(fill, path)
  }
  return path
}

export function objectBounds(object: CanvasObject): Rect {
  if (object.type === 'stroke') return strokeBounds(object)
  if (object.type === 'text') return textBounds(object)
  let rect = fillBounds.get(object)
  if (!rect) {
    rect = boundsOfPoints(object.points)
    fillBounds.set(object, rect)
  }
  return rect
}

export function paintObject(ctx: CanvasRenderingContext2D, object: CanvasObject): void {
  if (object.type === 'stroke') paintStroke(ctx, object)
  else if (object.type === 'text') paintText(ctx, object)
  else {
    ctx.globalAlpha = object.opacity
    ctx.fillStyle = object.color
    ctx.fill(fillPath(object))
    ctx.globalAlpha = 1
  }
}
