import broomUrl from '../../assets/broom.png'

/**
 * Broomit's broom, the same picture as in the logo. Shared by the toolbar icons and the canvas
 * (the broom cursor and the laser pointer), so they always match.
 */
export const BROOM_URL = broomUrl

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
