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
  // handle
  'M20 3.5 14.7 11.4',
  // bristles, fanning out from the ferrule
  'M12.5 9.9l4.3 2.6c-.6 3.4-1.4 6.2-2.8 8.9-4.3-.2-8.3-2.4-10.5-6 3.4.1 6.6-1.7 9-5.5z',
  'M8.4 17.6c1.9-.9 3.5-2.2 4.8-3.8',
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
