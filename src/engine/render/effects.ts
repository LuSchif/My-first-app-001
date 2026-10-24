import { parseHex } from '../model/fill.ts'
import type { Rect } from '../geometry/rect.ts'
import type { GradientPaint, Shadow } from '../model/types.ts'

/**
 * Gradients and shadows for objects on the page.
 */

/**
 * A canvas gradient over a rectangle, the way CSS lays it out: a linear gradient runs through
 * the middle at its angle (0 up, 90 right) and just reaches the corners; a radial one grows
 * from the middle to the farthest corner.
 */
export function canvasGradient(
  ctx: CanvasRenderingContext2D,
  paint: GradientPaint,
  rect: { x: number; y: number; width: number; height: number },
): CanvasGradient {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  let gradient: CanvasGradient
  if (paint.type === 'linear') {
    const a = (paint.angle * Math.PI) / 180
    const dx = Math.sin(a)
    const dy = -Math.cos(a)
    const half = (Math.abs(rect.width * dx) + Math.abs(rect.height * dy)) / 2
    gradient = ctx.createLinearGradient(
      cx - dx * half,
      cy - dy * half,
      cx + dx * half,
      cy + dy * half,
    )
  } else {
    gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(rect.width, rect.height) / 2)
  }
  for (const stop of [...paint.stops].sort((p, q) => p.offset - q.offset)) {
    gradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color)
  }
  return gradient
}

/** A rectangle from page bounds. */
export function rectOf(bounds: Rect): { x: number; y: number; width: number; height: number } {
  return {
    x: bounds.minX,
    y: bounds.minY,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  }
}

/** How far a shadow reaches beyond its object, in points. */
export function shadowPad(shadow: Shadow | undefined): number {
  return shadow ? shadow.blur * 1.5 + shadow.distance + 1 : 0
}

function rgba(hex: string, alpha: number): string {
  const full = parseHex(hex) ?? '#000000'
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16)
  return `rgba(${n(1)}, ${n(3)}, ${n(5)}, ${alpha})`
}

let surface: CanvasRenderingContext2D | null = null

/**
 * Paints an object with a shadow: the object is drawn on a surface of its own first, then put
 * onto the page in one go with the shadow, so an object made of many parts (a table, a text
 * with an outline) casts one shadow. `area` is the object's reach on the page, shadow included.
 */
export function paintWithShadow(
  ctx: CanvasRenderingContext2D,
  shadow: Shadow,
  area: Rect,
  paint: (target: CanvasRenderingContext2D) => void,
): void {
  surface ??= document.createElement('canvas').getContext('2d')!
  const { width, height } = ctx.canvas
  if (surface.canvas.width !== width || surface.canvas.height !== height) {
    surface.canvas.width = width
    surface.canvas.height = height
  }
  const t = ctx.getTransform()
  // The object's area in canvas pixels; only that part is cleared and copied.
  const corners = [
    t.transformPoint({ x: area.minX, y: area.minY }),
    t.transformPoint({ x: area.maxX, y: area.minY }),
    t.transformPoint({ x: area.minX, y: area.maxY }),
    t.transformPoint({ x: area.maxX, y: area.maxY }),
  ]
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.x))))
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p.y))))
  const x1 = Math.min(width, Math.ceil(Math.max(...corners.map((p) => p.x))))
  const y1 = Math.min(height, Math.ceil(Math.max(...corners.map((p) => p.y))))
  if (x1 <= x0 || y1 <= y0) return
  surface.setTransform(1, 0, 0, 1, 0, 0)
  surface.globalAlpha = 1
  surface.globalCompositeOperation = 'source-over'
  surface.clearRect(x0, y0, x1 - x0, y1 - y0)
  surface.setTransform(t)
  paint(surface)
  // Canvas shadows are measured in canvas pixels, not page points.
  const scale = Math.hypot(t.a, t.b)
  const a = (shadow.angle * Math.PI) / 180
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.shadowColor = rgba(shadow.color, shadow.opacity)
  ctx.shadowBlur = shadow.blur * scale
  ctx.shadowOffsetX = Math.cos(a) * shadow.distance * scale
  ctx.shadowOffsetY = Math.sin(a) * shadow.distance * scale
  // The copy is drawn a little larger than the object, so its shadow is not cut off.
  ctx.drawImage(surface.canvas, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
  ctx.restore()
}
