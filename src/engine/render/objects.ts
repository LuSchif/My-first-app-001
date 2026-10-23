import { boxBounds, isBox } from '../geometry/box.ts'
import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { traceStroke } from '../geometry/strokePath.ts'
import type { CanvasObject, FillObject } from '../model/types.ts'
import { paintImage } from './images.ts'
import { paintTable } from './table.ts'
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
  if (isBox(object)) return boxBounds(object, object.outline?.width ?? 0)
  let rect = fillBounds.get(object)
  if (!rect) {
    rect = boundsOfPoints(object.points, (object.outline?.width ?? 0) / 2)
    fillBounds.set(object, rect)
  }
  return rect
}

export function paintObject(ctx: CanvasRenderingContext2D, object: CanvasObject): void {
  if (object.type === 'stroke') paintStroke(ctx, object)
  else if (object.type === 'text') paintText(ctx, object)
  else if (object.type === 'image') paintImage(ctx, object)
  else if (object.type === 'table') paintTable(ctx, object)
  else {
    ctx.globalAlpha = object.opacity
    ctx.fillStyle = object.color
    ctx.fill(fillPath(object))
    if (object.outline) {
      ctx.lineWidth = object.outline.width
      ctx.lineJoin = 'round'
      ctx.strokeStyle = object.outline.color
      ctx.stroke(fillPath(object))
    }
    ctx.globalAlpha = 1
  }
}
