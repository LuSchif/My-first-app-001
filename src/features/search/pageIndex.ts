import type { Notebook, Page } from '../../engine/model/types.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { preloadPictures, renderPage } from '../../engine/render/pageImage.ts'
import { recognizeText } from '../../lib/ocr.ts'
import { db, type PageText } from '../../storage/db.ts'

/**
 * The text on every page, for search: typed text as it is, plus what text recognition reads in
 * a picture of the page (handwriting, and text in photos). Pages are read in the background
 * while the library is open, one at a time, and only again after they changed.
 */

/** Pixels per point of the picture that is read: large enough for small handwriting. */
const READ_SCALE = 2
/** Pause between two pages, so the library stays smooth. */
const PAUSE_MS = 300

let running = false
let paused = true
let again = false

/** Starts (or resumes) reading the pages that changed; stops while `setIndexing(false)`. */
export function setIndexing(on: boolean): void {
  paused = !on
  if (on) void indexAll()
}

async function indexAll(): Promise<void> {
  if (running) {
    again = true
    return
  }
  running = true
  try {
    do {
      again = false
      const notebooks = await db.notebooks.toArray()
      const ids = new Set(notebooks.map((n) => n.id))
      // Text of notebooks that are gone.
      await db.pageTexts.filter((t) => !ids.has(t.notebookId)).delete()
      for (const notebook of notebooks) {
        if (paused) return
        await indexNotebook(notebook)
      }
    } while (again && !paused)
  } catch (error) {
    // Reading is a convenience: a failure (offline in the browser, say) waits for next time.
    console.warn('Page text recognition stopped:', error)
  } finally {
    running = false
  }
}

async function indexNotebook(notebook: Notebook): Promise<void> {
  const pages = await db.pages.where('notebookId').equals(notebook.id).toArray()
  const known = new Map(
    (await db.pageTexts.where('notebookId').equals(notebook.id).toArray()).map((t) => [
      t.pageId,
      t,
    ]),
  )
  const ids = new Set(pages.map((p) => p.id))
  const gone = [...known.keys()].filter((id) => !ids.has(id))
  if (gone.length) await db.pageTexts.bulkDelete(gone)
  for (const page of pages) {
    if (paused) return
    if (known.get(page.id)?.updatedAt === page.updatedAt) continue
    const text = await readPage(notebook, page)
    await db.pageTexts.put({
      pageId: page.id,
      notebookId: notebook.id,
      updatedAt: page.updatedAt,
      text,
    })
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
  }
}

/** Typed text first, then what is read in the page's picture. */
async function readPage(notebook: Notebook, page: Page): Promise<string> {
  const typed = page.objects.flatMap((o) => (o.type === 'text' ? [o.text] : []))
  const drawn = page.objects.some((o) => o.type !== 'text')
  if (!drawn) return typed.join('\n')
  await preloadPictures([page])
  // On white, without ruled lines, which only confuse the reader.
  const plain: Page = { ...page, paper: 'blank', background: '#ffffff' }
  const canvas = renderPage(plain, notebook.layers, READ_SCALE, '#ffffff', pageSizeOf(notebook))
  try {
    const read = await recognizeText(canvas)
    return [...typed, read].filter(Boolean).join('\n')
  } finally {
    canvas.width = canvas.height = 0
  }
}

/** Notebooks whose pages contain `query` (any case), with a short piece of the text around it. */
export async function searchPageTexts(query: string): Promise<Map<string, string>> {
  const q = query.trim().toLocaleLowerCase()
  const found = new Map<string, string>()
  if (!q) return found
  await db.pageTexts.each((t: PageText) => {
    if (found.has(t.notebookId)) return
    const flat = t.text.replace(/\s+/g, ' ')
    const at = flat.toLocaleLowerCase().indexOf(q)
    if (at < 0) return
    const start = Math.max(0, at - 24)
    const end = Math.min(flat.length, at + q.length + 24)
    found.set(
      t.notebookId,
      `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`,
    )
  })
  return found
}
