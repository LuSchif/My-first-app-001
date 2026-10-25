import broomUrl from '../../assets/broom.png'

/**
 * Broomit's broom, the same picture as in the logo. Shared by the toolbar icons and the canvas
 * (the broom cursor and the laser pointer), so they always match.
 */
export const BROOM_URL = broomUrl

/**
 * The same broom as a line pictogram on a 24 × 24 grid with round caps, like the Lucide icons,
 * for toolbars: stroke them in one color.
 */
export const BROOM_PATHS = [
  // handle with its cap band
  'M14 9.7 18.3 2.6a1.3 1.3 0 0 1 2.2 1.4l-4.3 7.1',
  'M17.4 4.2l2.2 1.3',
  // ferrule
  'M13.1 9.2l4.1 2.4-1.2 2.6-4.8-2.8z',
  // bristles fanning out, with two gaps
  'M11.1 11.9C9 14.2 6.4 15.4 3.2 15.3c1.6 3.2 4.8 5.6 8.4 6.1l2.6.1c.9-2.2 1.4-4.3 1.8-6.7',
  'M7.6 17.6c1.9-.9 3.5-2.2 4.8-3.8',
  'M10.6 20.9c1.4-1.9 2.4-4 2.9-6.3',
  // swept-up dust
  'M4.4 11.4l1.7 1.3',
  'M6.9 9.1l.8 1.9',
] as const

/** Width over height of the picture. */
export const BROOM_ASPECT = 360 / 384

/** The middle of the bristles, as a share of the picture's width and height: the spot that sweeps. */
export const BROOM_HEAD = { x: 0.45, y: 0.86 } as const

/** How wide the bristles are, as a share of the picture's height. */
export const BROOM_BRISTLES = 0.5

let image: HTMLImageElement | null = null
const tinted = new Map<string, HTMLCanvasElement>()

function broomImage(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null
  if (!image) {
    image = new Image()
    image.src = broomUrl
  }
  return image.complete && image.naturalWidth > 0 ? image : null
}

/** The broom recolored toward `color` (for the laser), keeping its light and dark parts. */
function tintedBroom(img: HTMLImageElement, color: string): HTMLCanvasElement {
  let canvas = tinted.get(color)
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    ctx.globalCompositeOperation = 'source-atop'
    ctx.globalAlpha = 0.62
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    tinted.set(color, canvas)
  }
  return canvas
}

/**
 * Draws the broom with its bristles centered on (x, y), `size` CSS pixels tall, in its own
 * colors or tinted toward `color`. Nothing is drawn until the picture has loaded (in a moment,
 * the first time).
 */
export function drawBroom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color?: string,
): void {
  const img = broomImage()
  if (!img) return
  const height = size
  const width = size * BROOM_ASPECT
  ctx.save()
  // A soft light edge keeps the broom cursor visible on dark ink. The laser's broom moves every
  // frame and goes without: a blurred edge each frame would make it lag.
  if (!color) {
    ctx.shadowColor = 'rgba(255, 252, 247, 0.9)'
    ctx.shadowBlur = 3
  }
  ctx.drawImage(
    color ? tintedBroom(img, color) : img,
    x - BROOM_HEAD.x * width,
    y - BROOM_HEAD.y * height,
    width,
    height,
  )
  ctx.restore()
}
