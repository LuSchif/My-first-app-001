import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { insertPages, removePage, setPageObjects } from '../engine/commands/commands.ts'
import { History } from '../engine/commands/History.ts'
import { NotebookDocument } from '../engine/document/NotebookDocument.ts'
import { createNotebook, createPage } from '../engine/model/factory.ts'
import { Autosave } from './Autosave.ts'
import { BroomitDatabase } from './db.ts'
import {
  createNotebookRecord,
  deleteNotebook,
  deletePages,
  listNotebooks,
  loadNotebook,
  saveChanges,
} from './notebooks.ts'

let dbCount = 0
const freshDb = () => new BroomitDatabase(`test-${++dbCount}`)

function newNotebook(title = 'Biology') {
  return createNotebook({ title, paper: 'lined', cover: { type: 'solid', color: '#b98b65' } })
}

describe('notebook storage', () => {
  it('loads a handwritten stroke back exactly as it was saved', async () => {
    const database = freshDb()
    const { notebook, pages } = newNotebook()
    const page = pages[0]!
    const stroke = {
      id: 'ink-1',
      type: 'stroke' as const,
      layerId: notebook.layers[0]!.id,
      tool: 'pen' as const,
      color: '#3e2d25',
      width: 2,
      opacity: 1,
      points: [10.25, 20.5, 11.125, 21.75, 13.0625, 22.875],
      widths: [1.8, 2.1, 2.4],
      input: {
        device: 'pen' as const,
        t: [0, 4, 8],
        p: [0.312, 0.5, 0.744],
        altitude: [52.5, 51.9, 50.2],
        azimuth: [31.4, 31.6, 32],
      },
    }
    await createNotebookRecord(notebook, [{ ...page, objects: [stroke] }], database)
    const loaded = await loadNotebook(notebook.id, database)
    expect(loaded?.pages[0]?.objects[0]).toEqual(stroke)
  })

  it('deletes one page, but never the last one', async () => {
    const database = freshDb()
    const { notebook, pages } = newNotebook()
    const second = createPage(notebook.id, 'lined')
    const two = { ...notebook, pageIds: [...notebook.pageIds, second.id] }
    await createNotebookRecord(two, [...pages, second], database)
    await deletePages(two.id, [pages[0]!.id], 1, database)
    let loaded = await loadNotebook(two.id, database)
    expect(loaded?.notebook.pageIds).toEqual([second.id])
    expect(loaded?.pages.map((p) => p.id)).toEqual([second.id])
    await deletePages(two.id, [second.id], 1, database)
    loaded = await loadNotebook(two.id, database)
    expect(loaded?.notebook.pageIds).toEqual([second.id])
  })

  it('stores a new notebook and loads it back', async () => {
    const database = freshDb()
    const { notebook, pages } = newNotebook()
    await createNotebookRecord(notebook, pages, database)
    const loaded = await loadNotebook(notebook.id, database)
    expect(loaded?.notebook.title).toBe('Biology')
    expect(loaded?.pages.map((p) => p.id)).toEqual(notebook.pageIds)
  })

  it('autosaves strokes and page changes, and deletes removed pages', async () => {
    const database = freshDb()
    const { notebook, pages } = newNotebook()
    await createNotebookRecord(notebook, pages, database)
    const doc = new NotebookDocument(notebook, pages)
    const history = new History(doc)
    const autosave = new Autosave(doc, (c) => saveChanges(c, database), 10)

    const pageId = pages[0]!.id
    history.execute(
      setPageObjects(
        'Draw',
        pageId,
        [],
        [
          {
            id: 's1',
            type: 'stroke',
            layerId: notebook.layers[0]!.id,
            tool: 'pen',
            color: '#000000',
            width: 2,
            opacity: 1,
            points: [1, 2, 3, 4],
          },
        ],
      ),
    )
    const extra = createPage(notebook.id, 'grid')
    history.execute(insertPages('Add page', 1, [extra]))
    await autosave.flush()

    let loaded = await loadNotebook(notebook.id, database)
    expect(loaded?.pages.find((p) => p.id === pageId)?.objects[0]?.id).toBe('s1')
    expect(loaded?.notebook.pageIds).toEqual([pageId, extra.id])

    history.execute(removePage('Delete page', extra.id))
    await autosave.flush()
    loaded = await loadNotebook(notebook.id, database)
    expect(loaded?.pages.map((p) => p.id)).toEqual([pageId])
    expect(autosave.status).toBe('saved')
    autosave.dispose()
  })

  it('keeps changes and retries when a save fails', async () => {
    const { notebook, pages } = newNotebook()
    const doc = new NotebookDocument(notebook, pages)
    let fail = true
    const saved: string[] = []
    const autosave = new Autosave(
      doc,
      async (c) => {
        if (fail) throw new Error('disk full')
        saved.push(...c.pages.map((p) => p.id))
      },
      10,
    )
    doc.setObjects(pages[0]!.id, [])
    await autosave.flush()
    expect(autosave.status).toBe('error')
    expect(doc.hasUnsavedChanges()).toBe(true)
    fail = false
    await autosave.flush()
    expect(saved).toEqual([pages[0]!.id])
    expect(autosave.status).toBe('saved')
    autosave.dispose()
  })

  it('lists notebooks newest first and deletes them with their pages', async () => {
    const database = freshDb()
    const a = newNotebook('A')
    const b = newNotebook('B')
    b.notebook.updatedAt = a.notebook.updatedAt + 1000
    await createNotebookRecord(a.notebook, a.pages, database)
    await createNotebookRecord(b.notebook, b.pages, database)
    expect((await listNotebooks(database)).map((n) => n.title)).toEqual(['B', 'A'])
    await deleteNotebook(b.notebook.id, database)
    expect((await listNotebooks(database)).map((n) => n.title)).toEqual(['A'])
    expect(await database.pages.where('notebookId').equals(b.notebook.id).count()).toBe(0)
  })
})
