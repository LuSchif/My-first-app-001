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
 * folders) says so in a notice that can undo it. A drag of several selected items moves (or
 * deletes) them all; `after` runs once it is done, e.g. to end the selection.
 */
export function makeDrop(
  library: Library,
  reload: () => void,
  organizer?: Organizer | null,
  after?: () => void,
) {
  return (item: DragItem) => (target: DropTarget) => {
    if (item.kind === 'page') return
    const items = item.many?.length ? item.many : [{ id: item.id, label: item.label }]
    const done = () => {
      after?.()
      reload()
    }
    if (target.kind === 'trash') {
      trashItems(item.kind, items, library, done)
      return
    }
    // Groups only sort the home screen; nothing moves between folders.
    if (target.kind === 'group') {
      organizer?.moveManyToGroup(
        items.map((i) => i.id),
        target.id,
        items.length === 1 ? `“${items[0]!.label}”` : `${items.length} items`,
      )
      after?.()
      return
    }
    if (items.length > 1) {
      // Several at once go into the folder (or out of all folders); none is sorted.
      const into = target.kind === 'root' ? null : target.id
      void moveMany(item.kind, items, into, library, done)
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
        showNotice(`Moved “${item.label}” to ${placeName(into, library)}.`, {
          label: 'Undo',
          run: () => {
            const back =
              item.kind === 'notebook' ? moveNotebook(item.id, before) : moveFolder(item.id, before)
            back.catch((err: unknown) => console.error(err)).finally(reload)
          },
        })
      })
      .catch((err: unknown) => console.error(err))
      .finally(done)
  }
}

function placeName(folderId: string | null, library: Library): string {
  return folderId
    ? `“${library.folders.find((f) => f.id === folderId)?.name ?? 'folder'}”`
    : 'no folder'
}

/**
 * Moves several folders or notebooks into a folder (or out of all folders), with one notice
 * that undoes all of it. A folder never goes into itself or its own folders; it is skipped.
 */
export async function moveMany(
  kind: 'folder' | 'notebook',
  items: readonly { id: string; label: string }[],
  into: string | null,
  library: Library,
  done: () => void,
): Promise<void> {
  const moved: { id: string; before: string | null }[] = []
  for (const { id } of items) {
    const before =
      kind === 'notebook'
        ? library.notebooks.find((n) => n.id === id)?.folderId
        : library.folders.find((f) => f.id === id)?.parentId
    if (before === undefined || before === into) continue
    try {
      await (kind === 'notebook' ? moveNotebook(id, into) : moveFolder(id, into))
      moved.push({ id, before })
    } catch (err) {
      console.error(err)
    }
  }
  done()
  if (!moved.length) return
  showNotice(
    `Moved ${moved.length} ${moved.length === 1 ? 'item' : 'items'} to ${placeName(into, library)}.`,
    {
      label: 'Undo',
      run: () => {
        void (async () => {
          for (const { id, before } of moved) {
            await (kind === 'notebook' ? moveNotebook(id, before) : moveFolder(id, before)).catch(
              (err: unknown) => console.error(err),
            )
          }
          done()
        })()
      },
    },
  )
}

/** Drops folders (with everything in them), notebooks, presentations or decks on the trash. */
function trashItems(
  kind: 'folder' | 'notebook',
  items: readonly { id: string; label: string }[],
  library: Library,
  done: () => void,
): void {
  const ids = items.map((i) => i.id)
  if (kind === 'notebook') {
    const first = library.notebooks.find((n) => n.id === ids[0])
    const what = first ? kindName(first) : 'notebook'
    const text =
      items.length === 1
        ? `Deleted ${what} “${items[0]!.label}”.`
        : `Deleted ${items.length} ${pluralKind(what)}.`
    moveToTrash(
      ids,
      text,
      { notebookIds: ids },
      async () => {
        for (const id of ids) await deleteNotebook(id)
      },
      done,
    )
    return
  }
  const count = ids.reduce(
    (sum, id) => sum + countNotebooks(library.folders, library.notebooks, id),
    0,
  )
  const contents = count
    ? ` and the ${count} ${count === 1 ? 'notebook' : 'notebooks'} in them`
    : ''
  const text =
    items.length === 1
      ? `Deleted folder “${items[0]!.label}”${contents.replace('them', 'it')}.`
      : `Deleted ${items.length} folders${contents}.`
  moveToTrash(
    ids,
    text,
    { folderIds: ids },
    async () => {
      for (const id of ids) await deleteFolder(id, false)
    },
    done,
  )
}

function pluralKind(what: string): string {
  return what === 'flashcards' ? 'decks of flashcards' : `${what}s`
}
