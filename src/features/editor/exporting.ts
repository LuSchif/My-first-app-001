import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import { PAGE_SIZE } from '../../engine/model/types.ts'
import { preloadPictures, renderPage } from '../../engine/render/pageImage.ts'
import { fileName, saveFile, saveFiles } from '../../lib/download.ts'
import { makePdf } from '../../lib/pdf.ts'
import { createNotebookFile, NOTEBOOK_FILE_EXTENSION } from '../../storage/notebookFile.ts'

export type ExportFormat = 'broomit' | 'pdf' | 'jpg'

/** Pixels per point: about 216 dpi, sharp in print and on a Retina screen. */
const EXPORT_SCALE = 3

/**
 * Exports pages of the open notebook (all of them when `indices` is omitted). The current state
 * is used, including changes that are not saved yet.
 */
export async function exportPages(
  doc: NotebookDocument,
  format: ExportFormat,
  indices?: number[],
): Promise<void> {
  const all = doc.pageList
  const chosen = indices ?? all.map((_, i) => i)
  const pages = chosen.flatMap((i) => (all[i] ? [all[i]] : []))
  if (pages.length === 0) return
  const title = fileName(doc.notebook.title)
  const base = indices && chosen.length === 1 ? `${title} – Page ${chosen[0]! + 1}` : title

  if (format === 'broomit') {
    const blob = await createNotebookFile(doc.notebook, pages)
    saveFile(blob, `${base}${NOTEBOOK_FILE_EXTENSION}`)
    return
  }

  await preloadPictures(pages)
  const layers = doc.notebook.layers
  const jpegs: Blob[] = []
  for (const page of pages) {
    const canvas = renderPage(page, layers, EXPORT_SCALE, doc.notebook.background)
    jpegs.push(await toJpeg(canvas))
    // Free the memory of each big canvas right away; iPad limits canvas memory.
    canvas.width = canvas.height = 0
  }

  if (format === 'pdf') {
    const pdf = makePdf(
      await Promise.all(
        jpegs.map(async (blob) => ({
          jpeg: new Uint8Array(await blob.arrayBuffer()),
          width: Math.round(PAGE_SIZE.width * EXPORT_SCALE),
          height: Math.round(PAGE_SIZE.height * EXPORT_SCALE),
        })),
      ),
      PAGE_SIZE.width,
      PAGE_SIZE.height,
    )
    saveFile(pdf, `${base}.pdf`)
    return
  }

  const files = jpegs.map(
    (blob, k) =>
      new File(
        [blob],
        jpegs.length === 1 ? `${base}.jpg` : `${title} – Page ${chosen[k]! + 1}.jpg`,
        {
          type: 'image/jpeg',
        },
      ),
  )
  await saveFiles(files)
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the page'))),
      'image/jpeg',
      0.92,
    ),
  )
}
