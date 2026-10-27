import type { ImageObject } from './types.ts'

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
    top: image.title ? size * 1.25 * 1.6 : 0,
    bottom: image.caption ? size * 1.7 : 0,
  }
}

/**
 * The picture with a new crop, title and caption. The picture keeps its scale (points per
 * pixel) and its frame keeps its center, growing or shrinking for the part shown and the text.
 */
export function editPicture(
  image: ImageObject,
  pixels: { width: number; height: number },
  next: { crop: Crop; title: string; caption: string; fontSize: number },
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
