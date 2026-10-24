import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { tracePath, traceStroke } from '../geometry/strokePath.ts'
import type { StrokeObject } from '../model/types.ts'
import { canvasGradient, rectOf } from './effects.ts'
import { outlinePad, outlineReach } from './outline.ts'

// Objects are immutable, so derived data can be cached per object for its whole life.
const paths = new WeakMap<StrokeObject, Path2D>()
const bounds = new WeakMap<StrokeObject, Rect>()

export function strokePath(stroke: StrokeObject): Path2D {
  let path = paths.get(stroke)
  if (!path) {
    path = new Path2D()
    if (stroke.path) tracePath(path, stroke.path, stroke.closed)
    else traceStroke(path, stroke.points, { closed: stroke.closed, straight: stroke.straight })
    paths.set(stroke, path)
  }
  return path
}

/** Bounds including the line width. */
export function strokeBounds(stroke: StrokeObject): Rect {
  let rect = bounds.get(stroke)
  if (!rect) {
    rect = boundsOfPoints(stroke.points, stroke.width / 2 + outlinePad(stroke.outline))
    bounds.set(stroke, rect)
  }
  return rect
}

export function setInkStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<StrokeObject, 'width' | 'color' | 'dash'>,
): void {
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
  ctx.setLineDash(dashPattern(stroke))
}

/** Dash lengths for a line width; dots are zero-length dashes drawn with round caps. */
export function dashPattern(stroke: Pick<StrokeObject, 'width' | 'dash'>): number[] {
  const w = stroke.width
  if (stroke.dash === 'dashed') return [Math.max(4, w * 3), Math.max(3, w * 2.2)]
  if (stroke.dash === 'dotted') return [0, Math.max(2.5, w * 2)]
  return []
}

export function paintStroke(ctx: CanvasRenderingContext2D, stroke: StrokeObject): void {
  setInkStyle(ctx, stroke)
  ctx.globalAlpha = stroke.opacity
  // Highlighter tints what is below instead of covering it, like a real marker.
  ctx.globalCompositeOperation = stroke.tool === 'highlighter' ? 'multiply' : 'source-over'
  let width = stroke.width
  if (stroke.outline) {
    // The contour is a line of its own color underneath; reaching inside, it leaves a thinner
    // line of ink on top.
    const { outer, inner } = outlineReach(stroke.outline)
    ctx.lineWidth = stroke.width + outer * 2
    ctx.strokeStyle = stroke.outline.color
    ctx.stroke(strokePath(stroke))
    width = stroke.width - inner * 2
  }
  ctx.strokeStyle = stroke.gradient
    ? canvasGradient(ctx, stroke.gradient, rectOf(boundsOfPoints(stroke.points, 0)))
    : stroke.color
  if (width > 0.05) {
    ctx.lineWidth = width
    ctx.stroke(strokePath(stroke))
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.setLineDash([])
}
