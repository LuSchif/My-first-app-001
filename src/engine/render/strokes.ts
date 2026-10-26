import { boundsOfPoints, type Rect } from '../geometry/rect.ts'
import { flattenStroke, traceNib } from '../geometry/nib.ts'
import { tracePath, traceStroke } from '../geometry/strokePath.ts'
import type { StrokeObject } from '../model/types.ts'
import { canvasGradient, rectOf } from './effects.ts'
import { outlinePad, outlineReach } from './outline.ts'

// Objects are immutable, so derived data can be cached per object for its whole life.
const paths = new WeakMap<StrokeObject, Path2D>()
const bounds = new WeakMap<StrokeObject, Rect>()
const flats = new WeakMap<StrokeObject, number[]>()
const nibPaths = new WeakMap<StrokeObject, Map<number, Path2D>>()

/** Whether the stroke has a line width per point (fountain pen) instead of one width. */
function variable(stroke: StrokeObject): stroke is StrokeObject & { widths: number[] } {
  return Boolean(stroke.widths && !stroke.path && stroke.widths.length === stroke.points.length / 2)
}

/** The filled shape of a variable-width stroke, widened by `grow` on each side. */
function nibPath(stroke: StrokeObject & { widths: number[] }, grow: number): Path2D {
  let byGrow = nibPaths.get(stroke)
  if (!byGrow) nibPaths.set(stroke, (byGrow = new Map()))
  let path = byGrow.get(grow)
  if (!path) {
    let flat = flats.get(stroke)
    if (!flat) flats.set(stroke, (flat = flattenStroke(stroke.points, stroke.widths)))
    path = new Path2D()
    traceNib(path, flat, grow)
    byGrow.set(grow, path)
  }
  return path
}

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
    const widest = variable(stroke)
      ? stroke.widths.reduce((m, w) => Math.max(m, w), 0)
      : stroke.width
    rect = boundsOfPoints(stroke.points, widest / 2 + outlinePad(stroke.outline))
    bounds.set(stroke, rect)
  }
  return rect
}

/**
 * The color a stroke is painted in. A highlighter is painted opaque in its color already faded
 * by its opacity, with the "darken" blend: over paper it looks the same as see-through ink, but
 * where two marks of one color overlap they stay one even tint instead of getting darker, and
 * text under it stays as dark as it was.
 */
export function inkColor(stroke: Pick<StrokeObject, 'color' | 'opacity'> & { tool?: string }) {
  if (stroke.tool !== 'highlighter') return stroke.color
  return fadeToWhite(stroke.color, stroke.opacity)
}

/** How a stroke blends with what is below it. */
export function inkBlend(stroke: { tool?: string }): GlobalCompositeOperation {
  return stroke.tool === 'highlighter' ? 'darken' : 'source-over'
}

/** The opacity a stroke is drawn with (a highlighter's is in its color already). */
export function inkAlpha(stroke: Pick<StrokeObject, 'opacity'> & { tool?: string }): number {
  return stroke.tool === 'highlighter' ? 1 : stroke.opacity
}

const faded = new Map<string, string>()

/** `color` (#rrggbb) at `opacity` over white, as an opaque color. */
export function fadeToWhite(color: string, opacity: number): string {
  const key = `${color}/${opacity}`
  let out = faded.get(key)
  if (!out) {
    const hex = /^#?([0-9a-f]{6})$/i.exec(color)?.[1]
    if (!hex) return color
    const a = Math.min(1, Math.max(0, opacity))
    out = `#${[0, 2, 4]
      .map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16)
        return Math.round(255 + (c - 255) * a)
          .toString(16)
          .padStart(2, '0')
      })
      .join('')}`
    faded.set(key, out)
  }
  return out
}

export function setInkStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<StrokeObject, 'width' | 'color' | 'dash' | 'opacity'> & { tool?: string },
): void {
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = inkColor(stroke)
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
  if (stroke.tool === 'tape') {
    paintTape(ctx, stroke)
    return
  }
  if (variable(stroke)) {
    paintNibStroke(ctx, stroke)
    return
  }
  setInkStyle(ctx, stroke)
  ctx.globalAlpha = inkAlpha(stroke)
  // Highlighter tints what is below instead of covering it, like a real marker.
  ctx.globalCompositeOperation = inkBlend(stroke)
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
    : inkColor(stroke)
  if (width > 0.05) {
    ctx.lineWidth = width
    ctx.stroke(strokePath(stroke))
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.setLineDash([])
}

function paintNibStroke(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeObject & { widths: number[] },
): void {
  ctx.globalAlpha = inkAlpha(stroke)
  ctx.globalCompositeOperation = inkBlend(stroke)
  let shrink = 0
  if (stroke.outline) {
    const { outer, inner } = outlineReach(stroke.outline)
    ctx.fillStyle = stroke.outline.color
    ctx.fill(nibPath(stroke, outer))
    shrink = inner
  }
  ctx.fillStyle = stroke.gradient
    ? canvasGradient(ctx, stroke.gradient, rectOf(boundsOfPoints(stroke.points, 0)))
    : inkColor(stroke)
  ctx.fill(nibPath(stroke, -shrink))
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

let stripes: CanvasPattern | null | undefined

/** Fine diagonal stripes, the texture of paper tape. */
function tapeTexture(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (stripes !== undefined) return stripes
  stripes = null
  if (typeof document === 'undefined') return null
  const tile = document.createElement('canvas')
  tile.width = 8
  tile.height = 8
  const t = tile.getContext('2d')
  if (!t) return null
  t.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  t.lineWidth = 1.5
  t.beginPath()
  t.moveTo(-2, 10)
  t.lineTo(10, -2)
  t.moveTo(6, 10)
  t.lineTo(10, 6)
  t.moveTo(-2, 2)
  t.lineTo(2, -2)
  t.stroke()
  stripes = ctx.createPattern(tile, 'repeat')
  return stripes
}

/**
 * Tape: an opaque band with flat ends and a striped texture, or once revealed, a faint outline
 * of where it sits so it can be tapped closed again.
 */
export function paintTape(ctx: CanvasRenderingContext2D, stroke: StrokeObject, alpha = 1): void {
  const path = strokePath(stroke)
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])
  ctx.globalCompositeOperation = 'source-over'
  if (stroke.revealed) {
    ctx.globalAlpha = 0.16 * alpha
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.stroke(path)
    ctx.globalAlpha = 1
    return
  }
  ctx.globalAlpha = alpha
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.stroke(path)
  const texture = tapeTexture(ctx)
  if (texture) {
    ctx.globalAlpha = 0.35 * alpha
    ctx.strokeStyle = texture
    ctx.stroke(path)
  }
  ctx.globalAlpha = 1
}
