import type { Folder, Notebook } from '../../engine/model/types.ts'
import type { DragItem, DropTarget } from './dragDrop.ts'
import { applyDrop } from './libraryActions.ts'
import type { Library } from './useLibrary.ts'

export type FolderSort = 'custom' | 'name' | 'recent'
export type NotebookSort = 'recent' | 'name' | 'created'

export const FOLDER_SORTS = [
  ['custom', 'Your order'],
  ['name', 'Name'],
  ['recent', 'Recently edited'],
] as const satisfies readonly (readonly [FolderSort, string])[]

export const NOTEBOOK_SORTS = [
  ['recent', 'Recently edited'],
  ['name', 'Name'],
  ['created', 'Newest first'],
] as const satisfies readonly (readonly [NotebookSort, string])[]

const byName = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function sortFolders(list: Folder[], sort: FolderSort, library: Library): Folder[] {
  if (sort === 'name') return [...list].sort((a, b) => byName.compare(a.name, b.name))
  if (sort === 'recent') {
    // A folder is as recent as the last edit of anything in it.
    const latest = (f: Folder) =>
      Math.max(
        f.updatedAt,
        ...library.notebooks.filter((n) => n.folderId === f.id).map((n) => n.updatedAt),
      )
    return [...list].sort((a, b) => latest(b) - latest(a))
  }
  return [...list].sort((a, b) => a.order - b.order)
}

export function sortNotebooks(list: Notebook[], sort: NotebookSort): Notebook[] {
  if (sort === 'name') return [...list].sort((a, b) => byName.compare(a.title, b.title))
  if (sort === 'created') return [...list].sort((a, b) => b.createdAt - a.createdAt)
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Runs a drop, then reloads the library. */
export function useDrop(library: Library, reload: () => void) {
  return (item: DragItem) => (target: DropTarget) => {
    applyDrop(item, target, library.folders)
      .catch((err: unknown) => console.error(err))
      .finally(reload)
  }
}
