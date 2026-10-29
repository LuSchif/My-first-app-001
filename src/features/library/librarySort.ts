import type { Folder, Notebook } from '../../engine/model/types.ts'
import type { DragItem, DropTarget } from './dragDrop.ts'
import { showNotice } from '../../lib/notices.ts'
import { deleteFolder, moveFolder, moveNotebook } from '../../storage/folders.ts'
import { deleteNotebook } from '../../storage/notebooks.ts'
import { moveToTrash } from './trash.ts'
import { kindName } from './kinds.ts'
import { applyDrop, countNotebooks } from './libraryActions.ts'
import type { Organizer } from './organizer.ts'
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

/**
 * Runs a drop, then reloads the library. Moving something into another folder (or out of all
 * folders) says so in a notice that can undo it.
 */
export function useDrop(library: Library, reload: () => void, organizer?: Organizer | null) {
  return (item: DragItem) => (target: DropTarget) => {
    if (target.kind === 'trash') {
      trashItem(item, library, reload)
      return
    }
    // Groups only sort the home screen; nothing moves between folders.
    if (target.kind === 'group') {
      organizer?.moveToGroup(item.id, target.id, item.label)
      return
    }
    const into = target.kind === 'root' ? null : target.place === 'inside' ? target.id : undefined
    const before =
      item.kind === 'notebook'
        ? library.notebooks.find((n) => n.id === item.id)?.folderId
        : library.folders.find((f) => f.id === item.id)?.parentId
    applyDrop(item, target, library.folders)
      .then(() => {
        if (into === undefined || before === undefined || into === before) return
        const where = into
          ? `“${library.folders.find((f) => f.id === into)?.name ?? 'folder'}”`
          : 'no folder'
        showNotice(`Moved “${item.label}” to ${where}.`, {
          label: 'Undo',
          run: () => {
            const back =
              item.kind === 'notebook' ? moveNotebook(item.id, before) : moveFolder(item.id, before)
            back.catch((err: unknown) => console.error(err)).finally(reload)
          },
        })
      })
      .catch((err: unknown) => console.error(err))
      .finally(reload)
  }
}

/** Drops a folder (with everything in it), notebook or presentation on the trash. */
function trashItem(item: DragItem, library: Library, reload: () => void): void {
  if (item.kind === 'notebook') {
    const notebook = library.notebooks.find((n) => n.id === item.id)
    const what = notebook ? kindName(notebook) : 'notebook'
    moveToTrash(
      [item.id],
      `Deleted ${what} “${item.label}”.`,
      () => deleteNotebook(item.id),
      reload,
    )
  } else if (item.kind === 'folder') {
    const count = countNotebooks(library.folders, library.notebooks, item.id)
    const contents = count
      ? ` and the ${count} ${count === 1 ? 'notebook' : 'notebooks'} in it`
      : ''
    moveToTrash(
      [item.id],
      `Deleted folder “${item.label}”${contents}.`,
      () => deleteFolder(item.id, false),
      reload,
    )
  }
}
