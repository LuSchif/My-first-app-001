import { boxBounds, isBox } from '../geometry/box.ts'
import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { traceStroke } from '../geometry/strokePath.ts'
import type { CanvasObject, FillObject } from '../model/types.ts'
import { paintChart } from './chart.ts'
import { paintImage } from './images.ts'
import { paintTable } from './table.ts'
import { canvasGradient, paintWithShadow, rectOf, shadowPad } from './effects.ts'
import { outlinePad } from './outline.ts'
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

/** Where an object draws on the page, its shadow included: what a redraw must cover. */
export function paintBounds(object: CanvasObject): Rect {
  const rect = objectBounds(object)
  const pad = shadowPad(object.shadow)
  if (!pad) return rect
  return {
    minX: rect.minX - pad,
    minY: rect.minY - pad,
    maxX: rect.maxX + pad,
    maxY: rect.maxY + pad,
  }
}

/** The object itself (without its shadow): what selection and taps work with. */
export function objectBounds(object: CanvasObject): Rect {
  if (object.type === 'stroke') return strokeBounds(object)
  if (object.type === 'text') return textBounds(object)
  if (isBox(object)) return boxBounds(object, outlinePad(object.outline) + 1)
  let rect = fillBounds.get(object)
  if (!rect) {
    rect = boundsOfPoints(object.points, outlinePad(object.outline))
    fillBounds.set(object, rect)
  }
  return rect
}

export function paintObject(ctx: CanvasRenderingContext2D, object: CanvasObject): void {
  if (object.shadow) {
    paintWithShadow(ctx, object.shadow, paintBounds(object), (target) => paintOwn(target, object))
  } else {
    paintOwn(ctx, object)
  }
}

function paintOwn(ctx: CanvasRenderingContext2D, object: CanvasObject): void {
  if (object.type === 'stroke') paintStroke(ctx, object)
  else if (object.type === 'text') paintText(ctx, object)
  else if (object.type === 'image') paintImage(ctx, object)
  else if (object.type === 'table') paintTable(ctx, object)
  else if (object.type === 'chart') paintChart(ctx, object)
  else {
    ctx.globalAlpha = object.opacity
    ctx.fillStyle = object.gradient
      ? canvasGradient(ctx, object.gradient, rectOf(boundsOfPoints(object.points, 0)))
      : object.color
    const path = fillPath(object)
    const outline = object.outline
    if (outline) {
      ctx.lineJoin = 'round'
      ctx.strokeStyle = outline.color
    }
    if (outline && (outline.position ?? 'outside') === 'outside') {
      // Twice as wide underneath the area: the inner half is covered by the fill.
      ctx.lineWidth = outline.width * 2
      ctx.stroke(path)
    }
    ctx.fill(path)
    if (outline?.position === 'center') {
      ctx.lineWidth = outline.width
      ctx.stroke(path)
    } else if (outline?.position === 'inside') {
      ctx.save()
      ctx.clip(path)
      ctx.lineWidth = outline.width * 2
      ctx.stroke(path)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}
