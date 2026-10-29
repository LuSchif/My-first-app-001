import type { Asset, Folder, Id, Notebook, Page } from '../engine/model/types.ts'
import { db, type BroomitDatabase } from './db.ts'
import { withDescendants } from './folders.ts'

/**
 * A copy of what is about to be deleted, kept in memory so Undo can put it back: deleting
 * happens at once (nothing is lost if the app is closed right after), and Undo restores it.
 */
export interface Snapshot {
  folders: Folder[]
  notebooks: Notebook[]
  pages: Page[]
  assets: Asset[]
}

/**
 * Copies folders (with everything in them), notebooks (with their pages and pictures) and
 * single pages (with their notebook, for its page order).
 */
export async function takeSnapshot(
  what: { folderIds?: Id[]; notebookIds?: Id[]; pageIds?: Id[] },
  database: BroomitDatabase = db,
): Promise<Snapshot> {
  return database.transaction(
    'r',
    [database.folders, database.notebooks, database.pages, database.assets],
    async () => {
      const allFolders = await database.folders.toArray()
      const folderIds = new Set<Id>()
      for (const id of what.folderIds ?? []) {
        for (const f of withDescendants(allFolders, id)) folderIds.add(f)
      }
      const folders = allFolders.filter((f) => folderIds.has(f.id))
      const inFolders = folderIds.size
        ? await database.notebooks
            .where('folderId')
            .anyOf([...folderIds])
            .toArray()
        : []
      const direct = await database.notebooks.bulkGet(what.notebookIds ?? [])
      const whole = new Map<Id, Notebook>()
      for (const n of [...inFolders, ...direct]) if (n) whole.set(n.id, n)
      const wholeIds = [...whole.keys()]
      const pages = wholeIds.length
        ? await database.pages.where('notebookId').anyOf(wholeIds).toArray()
        : []
      const assets = wholeIds.length
        ? await database.assets.where('notebookId').anyOf(wholeIds).toArray()
        : []
      // Single pages: the pages and the notebooks they belong to.
      const single = (await database.pages.bulkGet(what.pageIds ?? [])).filter(
        (p): p is Page => p !== undefined,
      )
      const owners = await database.notebooks.bulkGet([...new Set(single.map((p) => p.notebookId))])
      for (const n of owners) if (n && !whole.has(n.id)) whole.set(n.id, n)
      return { folders, notebooks: [...whole.values()], pages: [...pages, ...single], assets }
    },
  )
}

/** Puts everything in a snapshot back as it was. */
export async function restoreSnapshot(
  snapshot: Snapshot,
  database: BroomitDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.folders, database.notebooks, database.pages, database.assets],
    async () => {
      await database.folders.bulkPut(snapshot.folders)
      await database.notebooks.bulkPut(snapshot.notebooks)
      await database.pages.bulkPut(snapshot.pages)
      await database.assets.bulkPut(snapshot.assets)
    },
  )
}
