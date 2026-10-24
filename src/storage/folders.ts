import { newId } from '../engine/model/ids.ts'
import type { Folder, Id, Notebook, Page } from '../engine/model/types.ts'
import { db, type BroomitDatabase } from './db.ts'

/**
 * Folders hold notebooks and, optionally, other folders (`parentId`). Their order among their
 * siblings is `order`, set by drag and drop. A notebook belongs to one folder or to none.
 */

export async function listFolders(database: BroomitDatabase = db): Promise<Folder[]> {
  return (await database.folders.toArray()).sort((a, b) => a.order - b.order)
}

export async function createFolderRecord(
  folder: Folder,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.folders.add(folder)
}

export async function updateFolder(
  id: Id,
  patch: Partial<Pick<Folder, 'name' | 'fill' | 'icon'>>,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.folders.update(id, { ...patch, updatedAt: Date.now() })
}

/** Puts folders in this order (the ids of one parent's folders, first to last). */
export async function reorderFolders(ids: Id[], database: BroomitDatabase = db): Promise<void> {
  await database.transaction('rw', database.folders, async () => {
    await Promise.all(ids.map((id, order) => database.folders.update(id, { order })))
  })
}

/** The folder and every folder inside it, at any depth. */
export function withDescendants(folders: readonly Folder[], id: Id): Set<Id> {
  const out = new Set<Id>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id)
        grew = true
      }
    }
  }
  return out
}

export async function moveNotebook(
  notebookId: Id,
  folderId: Id | null,
  database: BroomitDatabase = db,
): Promise<void> {
  // Moving is not editing: the notebook keeps its date.
  await database.notebooks.update(notebookId, { folderId })
}

/** Puts a folder into another one (or at the top level); never into itself or its own folders. */
export async function moveFolder(
  folderId: Id,
  parentId: Id | null,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.folders, async () => {
    const folders = await database.folders.toArray()
    if (parentId && withDescendants(folders, folderId).has(parentId)) {
      throw new Error('A folder cannot go into itself.')
    }
    const siblings = folders.filter((f) => f.parentId === parentId)
    const order = Math.max(-1, ...siblings.map((f) => f.order)) + 1
    await database.folders.update(folderId, { parentId, order, updatedAt: Date.now() })
  })
}

/**
 * Deletes a folder. With `keepContents`, its notebooks and folders move up to where the folder
 * was; otherwise they are deleted with it, at every depth.
 */
export async function deleteFolder(
  id: Id,
  keepContents: boolean,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.folders, database.notebooks, database.pages, database.assets],
    async () => {
      const folders = await database.folders.toArray()
      const folder = folders.find((f) => f.id === id)
      if (!folder) return
      if (keepContents) {
        await database.notebooks.where('folderId').equals(id).modify({ folderId: folder.parentId })
        await database.folders.where('parentId').equals(id).modify({ parentId: folder.parentId })
        await database.folders.delete(id)
        return
      }
      const gone = [...withDescendants(folders, id)]
      const notebooks = await database.notebooks.where('folderId').anyOf(gone).toArray()
      const notebookIds = notebooks.map((n) => n.id)
      await database.pages.where('notebookId').anyOf(notebookIds).delete()
      await database.assets.where('notebookId').anyOf(notebookIds).delete()
      await database.notebooks.bulkDelete(notebookIds)
      await database.folders.bulkDelete(gone)
    },
  )
}

/** A copy of a notebook with new ids for it, its pages and its pictures. */
async function copyNotebook(
  notebook: Notebook,
  folderId: Id | null,
  database: BroomitDatabase,
): Promise<void> {
  const id = newId()
  const pages = await database.pages.where('notebookId').equals(notebook.id).toArray()
  const assets = await database.assets.where('notebookId').equals(notebook.id).toArray()
  const pageIds = new Map(pages.map((p) => [p.id, newId()]))
  const assetIds = new Map(assets.map((a) => [a.id, newId()]))
  const now = Date.now()
  const copies: Page[] = pages.map((page) => ({
    ...page,
    id: pageIds.get(page.id)!,
    notebookId: id,
    updatedAt: now,
    objects: page.objects.map((o) =>
      o.type === 'image' ? { ...o, assetId: assetIds.get(o.assetId) ?? o.assetId } : o,
    ),
  }))
  await database.notebooks.add({
    ...notebook,
    id,
    folderId,
    pageIds: notebook.pageIds.map((p) => pageIds.get(p) ?? p),
    createdAt: now,
    updatedAt: notebook.updatedAt,
  })
  await database.pages.bulkAdd(copies)
  await database.assets.bulkAdd(
    assets.map((a) => ({ ...a, id: assetIds.get(a.id)!, notebookId: id })),
  )
}

/**
 * Copies a folder with everything in it (notebooks and folders, at every depth). The copy sits
 * right after the original and is named "… copy". Returns the copy's id.
 */
export async function duplicateFolder(id: Id, database: BroomitDatabase = db): Promise<Id> {
  return database.transaction(
    'rw',
    [database.folders, database.notebooks, database.pages, database.assets],
    async () => {
      const folders = await database.folders.toArray()
      const source = folders.find((f) => f.id === id)
      if (!source) throw new Error('Folder not found.')
      const now = Date.now()
      const copyOf = async (folder: Folder, parentId: Id | null, name: string, order: number) => {
        const copyId = newId()
        await database.folders.add({
          ...folder,
          id: copyId,
          name,
          parentId,
          order,
          createdAt: now,
          updatedAt: now,
        })
        for (const notebook of await database.notebooks
          .where('folderId')
          .equals(folder.id)
          .toArray()) {
          await copyNotebook(notebook, copyId, database)
        }
        for (const child of folders.filter((f) => f.parentId === folder.id)) {
          await copyOf(child, copyId, child.name, child.order)
        }
        return copyId
      }
      // Right after the original: the folders after it move one place on.
      const siblings = folders
        .filter((f) => f.parentId === source.parentId)
        .sort((a, b) => a.order - b.order)
      const at = siblings.findIndex((f) => f.id === id)
      await Promise.all(
        siblings.slice(at + 1).map((f, i) => database.folders.update(f.id, { order: at + 2 + i })),
      )
      await Promise.all(
        siblings.slice(0, at + 1).map((f, i) => database.folders.update(f.id, { order: i })),
      )
      return copyOf(source, source.parentId, `${source.name} copy`, at + 1)
    },
  )
}
