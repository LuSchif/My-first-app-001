import type { Outline } from '../model/types.ts'

/** How far an outline reaches outside and inside the object's edge. */
export function outlineReach(outline: Outline): { outer: number; inner: number } {
  const w = outline.width
  if (outline.position === 'inside') return { outer: 0, inner: w }
  if (outline.position === 'center') return { outer: w / 2, inner: w / 2 }
  return { outer: w, inner: 0 }
}

/** Extra room an object needs around it for its outline. */
export function outlinePad(outline: Outline | undefined): number {
  return outline ? outlineReach(outline).outer : 0
}

/** The outline of a rectangle (a picture, table or chart) from (0, 0), `inset` outside it. */
export function strokeBoxOutline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  outline: Outline,
  inset = 0,
): void {
  const { outer, inner } = outlineReach(outline)
  // The band's middle line, measured outward from the edge.
  const d = (outer - inner) / 2 + inset
  ctx.lineWidth = outline.width
  ctx.strokeStyle = outline.color
  ctx.lineJoin = 'round'
  ctx.strokeRect(-d, -d, width + d * 2, height + d * 2)
}

let isolation: CanvasRenderingContext2D | null = null

/**
 * A cleared offscreen canvas the size of `like`, with its transform: for effects that must only
 * touch one object's own pixels, like an outline inside letters. Draw it back with `composite`.
 */
export function isolate(like: CanvasRenderingContext2D): CanvasRenderingContext2D {
  isolation ??= document.createElement('canvas').getContext('2d')!
  const { width, height } = like.canvas
  if (isolation.canvas.width !== width || isolation.canvas.height !== height) {
    isolation.canvas.width = width
    isolation.canvas.height = height
  }
  isolation.setTransform(1, 0, 0, 1, 0, 0)
  isolation.globalCompositeOperation = 'source-over'
  isolation.globalAlpha = 1
  isolation.clearRect(0, 0, width, height)
  isolation.setTransform(like.getTransform())
  return isolation
}

export function composite(ctx: CanvasRenderingContext2D, layer: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(layer.canvas, 0, 0)
  ctx.restore()
}
