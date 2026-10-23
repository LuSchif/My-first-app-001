/**
 * The broom drawn on a 24 × 24 grid with round line caps, like the Lucide icons. Shared by the
 * toolbar icon and the canvas cursor so both always match.
 */
export const BROOM_PATHS = [
  // handle
  'M20.5 3.5 13 11',
  // binding
  'm10.6 9.4 4 4',
  // head
  'M10.6 9.4 5.2 12a2 2 0 0 0-.6.4L3 14l7 7 1.6-1.6a2 2 0 0 0 .4-.6l2.6-5.4',
  // bristles
  'm7 17.5 2-2M9.6 19.4l1.6-1.6M4.6 15.4 6.2 13.8',
] as const

/** The middle of the broom head on the grid: the spot that sweeps. */
export const BROOM_HEAD = { x: 8.6, y: 15.4 } as const

let cached: Path2D[] | null = null

/** Draws the broom with its head centered on (x, y), `size` CSS pixels tall. */
export function drawBroom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  cached ??= BROOM_PATHS.map((d) => new Path2D(d))
  const scale = size / 24
  ctx.save()
  ctx.translate(x - BROOM_HEAD.x * scale, y - BROOM_HEAD.y * scale)
  ctx.scale(scale, scale)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // A light halo keeps the cursor visible on dark ink.
  ctx.strokeStyle = 'rgba(255, 252, 247, 0.95)'
  ctx.lineWidth = 4.5
  for (const path of cached) ctx.stroke(path)
  ctx.strokeStyle = '#3e2d25'
  ctx.lineWidth = 1.75
  for (const path of cached) ctx.stroke(path)
  ctx.restore()
}
