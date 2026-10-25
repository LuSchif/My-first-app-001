import { Plus } from 'lucide-react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { FolderCard, FolderRow } from '../folders/FolderCard.tsx'
import { useDrop } from './librarySort.ts'
import { openPeek } from './peek.ts'
import type { LibraryLayout } from './libraryLayout.ts'
import { NotebookCard, NotebookRow } from './NotebookCard.tsx'
import type { Library } from './useLibrary.ts'

/** The list view's frame: rows on one card, divided by lines. */
const LIST =
  'grid divide-y divide-line overflow-hidden rounded-card bg-surface-raised ring-1 ring-line'
const TILES = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] items-start gap-x-5 gap-y-7'

/** The + at the end of a grid or list that makes one more, e.g. "New folder". */
export interface AddAction {
  label: string
  onAdd: () => void
}

/** Folders as tiles or as a list; a tap looks inside. */
export function FolderGrid({
  folders,
  library,
  sortable,
  reload,
  add,
  layout = 'tiles',
}: {
  folders: Folder[]
  library: Library
  sortable: boolean
  reload: () => void
  add?: AddAction
  layout?: LibraryLayout
}) {
  const drop = useDrop(library, reload)
  if (layout === 'list') {
    if (!folders.length && !add) return null
    return (
      <ul className={LIST}>
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            folders={library.folders}
            notebooks={library.notebooks}
            onOpenFolder={() => openPeek({ kind: 'folder', id: folder.id })}
            onChanged={reload}
            onDrop={drop({ kind: 'folder', id: folder.id, label: folder.name })}
            sortable={sortable}
          />
        ))}
        {add ? <AddItem add={add} layout="list" /> : null}
      </ul>
    )
  }
  return (
    <ul className={TILES}>
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          folders={library.folders}
          notebooks={library.notebooks}
          onOpenFolder={() => openPeek({ kind: 'folder', id: folder.id })}
          onChanged={reload}
          onDrop={drop({ kind: 'folder', id: folder.id, label: folder.name })}
          sortable={sortable}
        />
      ))}
      {add ? <AddItem add={add} layout="tiles" /> : null}
    </ul>
  )
}

/** A big + tile after the last tile, or a "+ New …" row at the end of the list. */
function AddItem({ add, layout }: { add: AddAction; layout: LibraryLayout }) {
  return (
    <li className="grid min-w-0">
      {layout === 'tiles' ? (
        <button
          type="button"
          aria-label={add.label}
          onClick={add.onAdd}
          className="grid aspect-[6/5] w-full place-items-center rounded-card text-ink-muted ring-2 ring-line ring-inset transition-colors [border-style:dashed] hover:bg-hover hover:text-ink"
        >
          <span className="grid size-14 place-items-center rounded-full bg-surface-sunken">
            <Plus size={30} strokeWidth={1.75} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={add.onAdd}
          className="flex items-center gap-3 px-3 py-3 text-left text-sm font-semibold text-ink-muted hover:bg-hover"
        >
          <span className="grid w-12 place-items-center">
            <Plus size={22} />
          </span>
          {add.label}
        </button>
      )}
    </li>
  )
}

/**
 * Notebooks, presentations or decks as tiles or as a list; a tap looks inside. With
 * `showFolder`, each shows the folder it is in.
 */
export function NotebookGrid({
  notebooks,
  library,
  reload,
  add,
  showFolder = false,
  layout = 'tiles',
}: {
  notebooks: Notebook[]
  library: Library
  reload: () => void
  add?: AddAction
  showFolder?: boolean
  layout?: LibraryLayout
}) {
  const drop = useDrop(library, reload)
  const props = (notebook: Notebook) => ({
    notebook,
    folders: library.folders,
    onOpen: () => openPeek({ kind: 'notebook', id: notebook.id }),
    onChanged: reload,
    onDrop: drop({ kind: 'notebook', id: notebook.id, label: notebook.title }),
    showFolder,
  })
  if (layout === 'list') {
    return (
      <ul className={LIST}>
        {notebooks.map((notebook) => (
          <NotebookRow key={notebook.id} {...props(notebook)} />
        ))}
        {add ? <AddItem add={add} layout="list" /> : null}
      </ul>
    )
  }
  return (
    <ul className={TILES}>
      {notebooks.map((notebook) => (
        <NotebookCard key={notebook.id} {...props(notebook)} />
      ))}
      {add ? <AddItem add={add} layout="tiles" /> : null}
    </ul>
  )
}
