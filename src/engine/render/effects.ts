import type { Rect } from '../geometry/rect.ts'
import type { GradientPaint } from '../model/types.ts'

/** Gradients for objects on the page. */

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
