import type { Rect } from '../geometry/rect.ts'
import type { CanvasObject } from '../model/types.ts'
import { paintStroke, strokeBounds } from './strokes.ts'
import { paintText, textBounds } from './text.ts'

export function objectBounds(object: CanvasObject): Rect {
  return object.type === 'stroke' ? strokeBounds(object) : textBounds(object)
}

export function paintObject(ctx: CanvasRenderingContext2D, object: CanvasObject): void {
  if (object.type === 'stroke') paintStroke(ctx, object)
  else paintText(ctx, object)
}
