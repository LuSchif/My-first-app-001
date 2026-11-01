import type { Editor } from '../../engine/editor/Editor.ts'
import { newId } from '../../engine/model/ids.ts'
import type { BoxFrame, Id, ImageObject } from '../../engine/model/types.ts'
import { rememberImage } from '../../engine/render/images.ts'
import { putAsset } from '../../storage/notebooks.ts'

/** Longest side kept for pictures; enough for a sharp full page, small enough to store. */
const MAX_SIDE = 2400

/** A point of the window where something was dropped onto the page. */
export interface Drop {
  clientX: number
  clientY: number
}

/**
 * Adds a picture from the photo library or camera to the current page: it is scaled down if
 * very large, stored with the notebook, and placed selected so it can be moved right away.
 */
export async function insertPicture(
  editor: Editor,
  notebookId: string,
  file: File,
  drop?: Drop,
): Promise<void> {
  const source = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height))
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)
  let blob: Blob = file
  let bitmap = source
  if (scale < 1 || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(source, 0, 0, width, height)
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, 0.9),
    )
    source.close()
    bitmap = await createImageBitmap(blob)
  }
  const assetId = newId()
  await putAsset({ id: assetId, notebookId, blob, width, height })
  rememberImage(assetId, bitmap)
  placeAsset(editor, assetId, width, height, drop)
}

/**
 * Adds a picture made by Broomit (a sticker, a page as a picture) from an image blob of the
 * given size, `share` being the most of the page's width it takes.
 */
export async function insertImageBlob(
  editor: Editor,
  notebookId: string,
  blob: Blob,
  drop?: Drop,
  share = 0.5,
  sticker = false,
): Promise<void> {
  const bitmap = await createImageBitmap(blob)
  const assetId = newId()
  await putAsset({ id: assetId, notebookId, blob, width: bitmap.width, height: bitmap.height })
  rememberImage(assetId, bitmap)
  placeAsset(editor, assetId, bitmap.width, bitmap.height, drop, share, sticker)
}

/**
 * Places a picture already stored with this notebook. A new picture is medium sized (half the
 * page's width, a third of its height at most), so it never covers the page; it can be scaled up
 * afterwards.
 */
export function placeAsset(
  editor: Editor,
  assetId: Id,
  width: number,
  height: number,
  drop?: Drop,
  share = 0.5,
  sticker = false,
): void {
  const page = editor.pageSize
  const fit = Math.min(1, (page.width * share) / width, page.height / 3 / height)
  const make = (frame: BoxFrame, layerId: Id): ImageObject => ({
    id: newId(),
    type: 'image',
    layerId,
    assetId,
    opacity: 1,
    ...(sticker ? { sticker: true } : {}),
    ...frame,
  })
  if (drop) editor.dropBox(make, width * fit, height * fit, drop.clientX, drop.clientY)
  else editor.insertBox(make, width * fit, height * fit)
}

/** Draws an SVG image into a PNG of `size` pixels on its longer side. */
export async function svgToPng(svg: string, size: number): Promise<Blob> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const k = size / Math.max(image.naturalWidth || size, image.naturalHeight || size)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round((image.naturalWidth || size) * k)
  canvas.height = Math.round((image.naturalHeight || size) * k)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/png'),
  )
}
