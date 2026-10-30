import type { UnsavedChanges } from '../engine/document/NotebookDocument.ts'
import type { Asset, CardStudy, Notebook, Page, PaperKind } from '../engine/model/types.ts'
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

/**
 * Removes pages from a notebook, e.g. one page, or both sides of a flashcard. Nothing is removed
 * when fewer than `keep` pages would be left.
 */
export async function deletePages(
  notebookId: string,
  pageIds: readonly string[],
  keep = 1,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    const notebook = await database.notebooks.get(notebookId)
    if (!notebook) return
    const gone = new Set(pageIds.filter((id) => notebook.pageIds.includes(id)))
    if (gone.size === 0 || notebook.pageIds.length - gone.size < keep) return
    await database.notebooks.put({
      ...notebook,
      pageIds: notebook.pageIds.filter((id) => !gone.has(id)),
      updatedAt: Date.now(),
    })
    await database.pages.bulkDelete([...gone])
  })
}

/** Adds a page at the end of a notebook. */
export async function appendPage(
  notebookId: string,
  page: Page,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    const notebook = await database.notebooks.get(notebookId)
    if (!notebook) return
    await database.pages.add(page)
    await database.notebooks.put({
      ...notebook,
      pageIds: [...notebook.pageIds, page.id],
      updatedAt: Date.now(),
    })
  })
}

/** Gives some pages of a notebook another paper. */
export async function setPagesPaper(
  notebookId: string,
  pageIds: readonly string[],
  paper: PaperKind,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.notebooks, database.pages, async () => {
    const now = Date.now()
    await database.pages
      .where('id')
      .anyOf([...pageIds])
      .modify({ paper, updatedAt: now })
    await database.notebooks.update(notebookId, { updatedAt: now })
  })
}

/** Flashcards: stores how well each card of a deck is known. */
export async function saveStudy(
  notebookId: string,
  study: Record<string, CardStudy>,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.notebooks.update(notebookId, { study })
}

/** Saves a quiz's questions (and its title), and when it was edited. */
export async function saveQuiz(
  id: string,
  patch: Partial<Pick<Notebook, 'quiz' | 'title'>>,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.notebooks.update(id, { ...patch, updatedAt: Date.now() })
}
