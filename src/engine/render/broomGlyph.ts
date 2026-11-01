/**
 * The broom drawn on a 24 × 24 grid with round line caps, like the Lucide icons. Shared by the
 * toolbar icon and the canvas cursor so both always match.
 */
export const BROOM_PATHS = [
  // handle
  'M12 1.5V10',
  // binding
  'M9.2 10h5.6a.8.8 0 0 1 .8.8v1a.8.8 0 0 1-.8.8H9.2a.8.8 0 0 1-.8-.8v-1a.8.8 0 0 1 .8-.8Z',
  // bristles: a fanned bundle
  'M9 12.6 5.6 21.4a.6.6 0 0 0 .56.8h11.68a.6.6 0 0 0 .56-.8L15 12.6',
  'M9.6 22.2 10.8 15.6M12 22.2V15.6M14.4 22.2 13.2 15.6',
] as const

/** The broom leans this far (degrees, clockwise) from upright, its head down to the left. */
export const BROOM_TILT = 35

/** The middle of the broom head on the grid (after the lean): the spot that sweeps. */
export const BROOM_HEAD = { x: 8.6, y: 16.9 } as const

let cached: Path2D[] | null = null

/**
 * Draws the broom with its head centered on (x, y), `size` CSS pixels tall, in `color` (the
 * app's ink brown unless given).
 */
export function drawBroom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = '#3e2d25',
): void {
  cached ??= BROOM_PATHS.map((d) => new Path2D(d))
  const scale = size / 24
  ctx.save()
  ctx.translate(x - BROOM_HEAD.x * scale, y - BROOM_HEAD.y * scale)
  ctx.scale(scale, scale)
  ctx.translate(12, 12)
  ctx.rotate((BROOM_TILT * Math.PI) / 180)
  ctx.translate(-12, -12)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // A light halo keeps the cursor visible on dark ink.
  ctx.strokeStyle = 'rgba(255, 252, 247, 0.95)'
  // Lines keep about the same screen width however large the broom is drawn.
  const k = Math.min(1, Math.sqrt(30 / size))
  ctx.lineWidth = 4.5 * k
  for (const path of cached) ctx.stroke(path)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.75 * k
  for (const path of cached) ctx.stroke(path)
  ctx.restore()
}
