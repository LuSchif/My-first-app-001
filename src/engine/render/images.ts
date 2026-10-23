import { enterBox } from '../geometry/box.ts'
import type { ImageObject } from '../model/types.ts'

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
  ctx.save()
  ctx.globalAlpha = image.opacity
  enterBox(ctx, image)
  if (bitmap) {
    ctx.save()
    if (image.flipX || image.flipY) {
      ctx.translate(image.flipX ? image.width : 0, image.flipY ? image.height : 0)
      ctx.scale(image.flipX ? -1 : 1, image.flipY ? -1 : 1)
    }
    ctx.drawImage(bitmap, 0, 0, image.width, image.height)
    ctx.restore()
  } else {
    // A quiet placeholder while the picture loads.
    ctx.fillStyle = 'rgba(216, 193, 165, 0.35)'
    ctx.fillRect(0, 0, image.width, image.height)
  }
  if (image.outline) {
    // A frame just outside the picture.
    const w = image.outline.width
    ctx.lineWidth = w
    ctx.strokeStyle = image.outline.color
    ctx.lineJoin = 'round'
    ctx.strokeRect(-w / 2, -w / 2, image.width + w, image.height + w)
  }
  ctx.restore()
}
