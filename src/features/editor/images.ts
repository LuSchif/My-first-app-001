import type { Editor } from '../../engine/editor/Editor.ts'
import { newId } from '../../engine/model/ids.ts'
import { rememberImage } from '../../engine/render/images.ts'
import { putAsset } from '../../storage/notebooks.ts'

/** Longest side kept for pictures; enough for a sharp full page, small enough to store. */
const MAX_SIDE = 2400

/**
 * Adds a picture from the photo library or camera to the current page: it is scaled down if
 * very large, stored with the notebook, and placed selected so it can be moved right away.
 */
export async function insertPicture(editor: Editor, notebookId: string, file: File): Promise<void> {
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
  // A new picture is medium sized (half the page's width, a third of its height at most), so it
  // never covers the page; it can be scaled up afterwards.
  const page = editor.pageSize
  const fit = Math.min(1, (page.width * 0.5) / width, page.height / 3 / height)
  editor.insertBox(
    (frame, layerId) => ({ id: newId(), type: 'image', layerId, assetId, opacity: 1, ...frame }),
    width * fit,
    height * fit,
  )
}
