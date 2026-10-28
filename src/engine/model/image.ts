import type { ImageObject, PictureShape } from './types.ts'

export type Crop = NonNullable<ImageObject['crop']>

export const FULL_CROP: Crop = { x: 0, y: 0, width: 1, height: 1 }
export const DEFAULT_CAPTION_SIZE = 14
export const DEFAULT_CAPTION_COLOR = '#3e2d25'

export function imageCrop(image: ImageObject): Crop {
  return image.crop ?? FULL_CROP
}

/** Room above the picture for its title and below it for its caption, in points. */
export function imageBands(image: ImageObject): { top: number; bottom: number } {
  const size = image.fontSize ?? DEFAULT_CAPTION_SIZE
  return {
    top: shownTitle(image) ? size * 1.25 * 1.6 : 0,
    bottom: shownCaption(image) ? size * 1.7 : 0,
  }
}

/** The title shown above the picture, or '' when there is none or it is switched off. */
export function shownTitle(image: ImageObject): string {
  return image.titleHidden ? '' : (image.title ?? '')
}

export function shownCaption(image: ImageObject): string {
  return image.captionHidden ? '' : (image.caption ?? '')
}

/**
 * The outline the picture is cut to, as SVG path data in a box of `width` × `height`: a shape,
 * or a rectangle with corners rounded by `rx` across and `ry` down (the same radius in points
 * gives different shares when the box is drawn stretched). Null for a plain rectangle.
 */
export function pictureOutline(
  shape: PictureShape | undefined,
  width: number,
  height: number,
  rx = 0,
  ry = rx,
): string | null {
  const w = width
  const h = height
  if (shape === 'circle') {
    return `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z`
  }
  if (shape === 'diamond') return `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z`
  if (shape === 'heart') {
    const P = (x: number, y: number) => `${x * w} ${y * h}`
    return (
      `M${P(0.5, 0.96)}` +
      `C${P(0.2, 0.76)} ${P(0, 0.56)} ${P(0, 0.32)}` +
      `C${P(0, 0.13)} ${P(0.14, 0.02)} ${P(0.29, 0.02)}` +
      `C${P(0.39, 0.02)} ${P(0.46, 0.08)} ${P(0.5, 0.18)}` +
      `C${P(0.54, 0.08)} ${P(0.61, 0.02)} ${P(0.71, 0.02)}` +
      `C${P(0.86, 0.02)} ${P(1, 0.13)} ${P(1, 0.32)}` +
      `C${P(1, 0.56)} ${P(0.8, 0.76)} ${P(0.5, 0.96)}Z`
    )
  }
  const x = Math.min(rx, w / 2)
  const y = Math.min(ry, h / 2)
  if (x <= 0 || y <= 0) return shape === 'square' ? `M0 0H${w}V${h}H0Z` : null
  return (
    `M${x} 0H${w - x}A${x} ${y} 0 0 1 ${w} ${y}V${h - y}A${x} ${y} 0 0 1 ${w - x} ${h}` +
    `H${x}A${x} ${y} 0 0 1 0 ${h - y}V${y}A${x} ${y} 0 0 1 ${x} 0Z`
  )
}

/** Only rectangles and squares take rounded corners. */
export function takesRoundCorners(shape: PictureShape | undefined): boolean {
  return shape === undefined || shape === 'square'
}

/** The largest crop inside `crop` that is square in pixels, around the same middle. */
export function squareCrop(crop: Crop, pixels: { width: number; height: number }): Crop {
  const side = Math.min(crop.width * pixels.width, crop.height * pixels.height)
  const width = side / pixels.width
  const height = side / pixels.height
  return {
    x: crop.x + (crop.width - width) / 2,
    y: crop.y + (crop.height - height) / 2,
    width,
    height,
  }
}

/**
 * The picture with a new crop, title and caption. The picture keeps its scale (points per
 * pixel) and its frame keeps its center, growing or shrinking for the part shown and the text.
 */
export function editPicture(
  image: ImageObject,
  pixels: { width: number; height: number },
  next: {
    crop: Crop
    title: string
    caption: string
    fontSize: number
    titleOn?: boolean
    captionOn?: boolean
    cornerRadius?: number
    shape?: PictureShape | null
  },
): ImageObject {
  const before = imageBands(image)
  const crop = imageCrop(image)
  const shownWidth = image.width
  const perPixel = shownWidth / Math.max(1e-6, crop.width * pixels.width)
  const width = next.crop.width * pixels.width * perPixel
  const height = next.crop.height * pixels.height * perPixel
  const full = next.crop.x <= 0 && next.crop.y <= 0 && next.crop.width >= 1 && next.crop.height >= 1
  const edited: ImageObject = {
    ...image,
    title: next.title,
    caption: next.caption,
    fontSize: next.fontSize,
  }
  if (full) delete edited.crop
  else edited.crop = next.crop
  if (!next.title) delete edited.title
  if (!next.caption) delete edited.caption
  if (next.titleOn === false && next.title) edited.titleHidden = true
  else delete edited.titleHidden
  if (next.captionOn === false && next.caption) edited.captionHidden = true
  else delete edited.captionHidden
  if (next.cornerRadius && next.cornerRadius > 0) edited.cornerRadius = next.cornerRadius
  else if (next.cornerRadius !== undefined) delete edited.cornerRadius
  if (next.shape) edited.shape = next.shape
  else if (next.shape === null) delete edited.shape
  const after = imageBands(edited)
  const frameHeight = height + after.top + after.bottom
  // The picture's own middle stays where it was on the page (turned with the frame).
  const cx = image.x + image.width / 2
  const cy = image.y + image.height / 2
  const shift = (before.top - before.bottom) / 2 - (after.top - after.bottom) / 2
  const cos = Math.cos(image.rotation)
  const sin = Math.sin(image.rotation)
  const ncx = cx - shift * sin
  const ncy = cy + shift * cos
  return {
    ...edited,
    width,
    height: frameHeight,
    x: ncx - width / 2,
    y: ncy - frameHeight / 2,
  }
}
