import { enterBox } from '../geometry/box.ts'
import type { ImageObject } from '../model/types.ts'
import {
  DEFAULT_CAPTION_COLOR,
  DEFAULT_CAPTION_SIZE,
  imageBands,
  imageCrop,
} from '../model/image.ts'
import { strokeBoxOutline } from './outline.ts'
import { FONT_STACKS } from './text.ts'

/** Where picture data comes from; the app connects this to its storage. */
export type ImageLoader = (assetId: string) => Promise<Blob | null>

let loader: ImageLoader | null = null
const cache = new Map<string, ImageBitmap | 'loading' | 'missing'>()
const listeners = new Set<() => void>()

export function setImageLoader(next: ImageLoader): void {
  loader = next
}

/** Called whenever a picture finished loading, so the scene can be drawn again. */
export function onImageLoaded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Keeps a decoded picture that was just added, so it shows without loading it back. */
export function rememberImage(assetId: string, bitmap: ImageBitmap): void {
  cache.set(assetId, bitmap)
}

/** The decoded picture, or null while it loads (loading starts on the first request). */
export function imageFor(assetId: string): ImageBitmap | null {
  const hit = cache.get(assetId)
  if (hit && hit !== 'loading' && hit !== 'missing') return hit
  if (!hit) void loadImage(assetId)
  return null
}

const pending = new Map<string, Promise<ImageBitmap | null>>()

/** Loads and decodes a picture, e.g. before drawing a page for export. */
export function loadImage(assetId: string): Promise<ImageBitmap | null> {
  const hit = cache.get(assetId)
  if (hit && hit !== 'loading') return Promise.resolve(hit === 'missing' ? null : hit)
  const running = pending.get(assetId)
  if (running) return running
  if (!loader) return Promise.resolve(null)
  cache.set(assetId, 'loading')
  const promise = loader(assetId)
    .then((blob) => (blob ? createImageBitmap(blob) : null))
    .then((bitmap) => {
      cache.set(assetId, bitmap ?? 'missing')
      for (const listener of listeners) listener()
      return bitmap
    })
    .catch(() => {
      cache.set(assetId, 'missing')
      return null
    })
    .finally(() => pending.delete(assetId))
  pending.set(assetId, promise)
  return promise
}

export function paintImage(ctx: CanvasRenderingContext2D, image: ImageObject): void {
  const bitmap = imageFor(image.assetId)
  const bands = imageBands(image)
  const shownHeight = Math.max(0, image.height - bands.top - bands.bottom)
  ctx.save()
  ctx.globalAlpha = image.opacity
  enterBox(ctx, image)
  if (bitmap) {
    ctx.save()
    ctx.translate(0, bands.top)
    if (image.flipX || image.flipY) {
      ctx.translate(image.flipX ? image.width : 0, image.flipY ? shownHeight : 0)
      ctx.scale(image.flipX ? -1 : 1, image.flipY ? -1 : 1)
    }
    const crop = imageCrop(image)
    ctx.drawImage(
      bitmap,
      crop.x * bitmap.width,
      crop.y * bitmap.height,
      crop.width * bitmap.width,
      crop.height * bitmap.height,
      0,
      0,
      image.width,
      shownHeight,
    )
    ctx.restore()
  } else {
    // A quiet placeholder while the picture loads.
    ctx.fillStyle = 'rgba(216, 193, 165, 0.35)'
    ctx.fillRect(0, bands.top, image.width, shownHeight)
  }
  const size = image.fontSize ?? DEFAULT_CAPTION_SIZE
  ctx.fillStyle = image.textColor ?? DEFAULT_CAPTION_COLOR
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (image.title) {
    ctx.font = `700 ${size * 1.25}px ${FONT_STACKS.sans}`
    ctx.fillText(image.title, image.width / 2, bands.top / 2, image.width)
  }
  if (image.caption) {
    ctx.font = `400 ${size}px ${FONT_STACKS.sans}`
    ctx.fillText(image.caption, image.width / 2, image.height - bands.bottom / 2, image.width)
  }
  if (image.outline) strokeBoxOutline(ctx, image.width, image.height, image.outline)
  ctx.restore()
}
