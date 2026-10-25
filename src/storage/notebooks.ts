import type { UnsavedChanges } from '../engine/document/NotebookDocument.ts'
import type { Asset, Notebook, Page } from '../engine/model/types.ts'
import { db, type BroomitDatabase } from './db.ts'

export async function listNotebooks(database: BroomitDatabase = db): Promise<Notebook[]> {
  return database.notebooks.orderBy('updatedAt').reverse().toArray()
}

export async function createNotebookRecord(
  notebook: Notebook,
  pages: Page[],
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    await database.notebooks.add(notebook)
    await database.pages.bulkAdd(pages)
  })
}

export async function loadNotebook(
  id: string,
  database: BroomitDatabase = db,
): Promise<{ notebook: Notebook; pages: Page[] } | null> {
  const notebook = await database.notebooks.get(id)
  if (!notebook) return null
  const pages = await database.pages.where('notebookId').equals(id).toArray()
  return { notebook, pages }
}

/** Writes changed pages and the notebook together, and deletes pages no longer in it. */
export async function saveChanges(
  changes: UnsavedChanges,
  database: BroomitDatabase = db,
): Promise<void> {
  const { notebook, pages } = changes
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    await database.notebooks.put(notebook)
    if (pages.length > 0) await database.pages.bulkPut(pages)
    const keep = new Set(notebook.pageIds)
    await database.pages
      .where('notebookId')
      .equals(notebook.id)
      .filter((page) => !keep.has(page.id))
      .delete()
  })
}

export async function deleteNotebook(id: string, database: BroomitDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    database.notebooks,
    database.pages,
    database.assets,
    async () => {
      await database.pages.where('notebookId').equals(id).delete()
      await database.assets.where('notebookId').equals(id).delete()
      await database.notebooks.delete(id)
    },
  )
}

export async function putAsset(asset: Asset, database: BroomitDatabase = db): Promise<void> {
  await database.assets.put(asset)
}

export async function getAssetBlob(
  id: string,
  database: BroomitDatabase = db,
): Promise<Blob | null> {
  return (await database.assets.get(id))?.blob ?? null
}

/** Removes one page from a notebook. A notebook's last page stays. */
export async function deletePage(
  notebookId: string,
  pageId: string,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    const notebook = await database.notebooks.get(notebookId)
    if (!notebook || notebook.pageIds.length <= 1 || !notebook.pageIds.includes(pageId)) return
    await database.notebooks.put({
      ...notebook,
      pageIds: notebook.pageIds.filter((id) => id !== pageId),
      updatedAt: Date.now(),
    })
    await database.pages.delete(pageId)
  })
}
