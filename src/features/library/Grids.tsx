import { Plus } from 'lucide-react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { FolderCard, FolderRow } from '../folders/FolderCard.tsx'
import { makeDrop } from './librarySort.ts'
import { useOrganizer } from './organizer.ts'
import { useLibrarySelection, type LibrarySelection } from './librarySelection.ts'
import { openPeek } from './peek.ts'
import type { LibraryLayout } from './libraryLayout.ts'
import { NotebookCard, NotebookRow } from './NotebookCard.tsx'
import type { Library } from './useLibrary.ts'

/** The list view's frame: rows on one card, divided by lines. */
const LIST =
  'grid divide-y divide-line overflow-hidden rounded-card bg-surface-raised ring-1 ring-line'
/**
 * Tiles: on the home screen every tile has the one width the carousel sets (`--tile-w`, so two
 * rows fit), spread across the row; elsewhere they fill their columns.
 */
const TILES =
  'grid grid-cols-[repeat(auto-fill,minmax(var(--tile-w,9.5rem),var(--tile-max,1fr)))] items-start justify-between gap-x-5 gap-y-5'

/** Tiles in a row that is only as wide as they are (e.g. the pinned ones), wrapping when full. */
const COMPACT_TILES = 'flex flex-wrap items-start gap-x-5 gap-y-5 [&>li]:w-[var(--tile-w,9.5rem)]'

/** The + first in a grid or list that makes one more, e.g. "New folder". */
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
  compact = false,
}: {
  folders: Folder[]
  library: Library
  sortable: boolean
  reload: () => void
  add?: AddAction
  layout?: LibraryLayout
  /** Only as wide as its tiles. */
  compact?: boolean
}) {
  const selection = useLibrarySelection()
  const drop = makeDrop(library, reload, useOrganizer(), selection?.clear)
  /** Dragging a selected folder drags (and drops) every selected one. */
  const withMany = (id: string, label: string) => {
    const many = carried(selection, id, (i) => library.folders.find((f) => f.id === i)?.name)
    return { many, onDrop: drop({ kind: 'folder', id, label, many }) }
  }
  const props = (folder: Folder) => ({
    folder,
    folders: library.folders,
    notebooks: library.notebooks,
    onOpenFolder: selection
      ? () => selection.toggle(folder.id)
      : () => openPeek({ kind: 'folder', id: folder.id }),
    onChanged: reload,
    sortable,
    selected: selection ? selection.has(folder.id) : undefined,
    ...withMany(folder.id, folder.name),
  })
  if (layout === 'list') {
    if (!folders.length && !add) return null
    return (
      <ul className={LIST}>
        {add ? <AddItem add={add} layout="list" /> : null}
        {folders.map((folder) => (
          <FolderRow key={folder.id} {...props(folder)} />
        ))}
      </ul>
    )
  }
  return (
    <ul className={compact ? COMPACT_TILES : TILES}>
      {add ? <AddItem add={add} layout="tiles" /> : null}
      {folders.map((folder) => (
        <FolderCard key={folder.id} {...props(folder)} />
      ))}
    </ul>
  )
}

/** A big + tile before the first tile, or a "+ New …" row at the top of the list. */
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
  compact = false,
}: {
  notebooks: Notebook[]
  library: Library
  reload: () => void
  add?: AddAction
  showFolder?: boolean
  layout?: LibraryLayout
  /** Only as wide as its tiles. */
  compact?: boolean
}) {
  const selection = useLibrarySelection()
  const drop = makeDrop(library, reload, useOrganizer(), selection?.clear)
  /** Dragging a selected item drags (and drops) every selected one. */
  const withMany = (id: string, label: string) => {
    const many = carried(selection, id, (i) => library.notebooks.find((n) => n.id === i)?.title)
    return { many, onDrop: drop({ kind: 'notebook', id, label, many }) }
  }
  const props = (notebook: Notebook) => ({
    notebook,
    folders: library.folders,
    onOpen: selection
      ? () => selection.toggle(notebook.id)
      : () => openPeek({ kind: 'notebook', id: notebook.id }),
    onChanged: reload,
    showFolder,
    selected: selection ? selection.has(notebook.id) : undefined,
    ...withMany(notebook.id, notebook.title),
  })
  if (layout === 'list') {
    return (
      <ul className={LIST}>
        {add ? <AddItem add={add} layout="list" /> : null}
        {notebooks.map((notebook) => (
          <NotebookRow key={notebook.id} {...props(notebook)} />
        ))}
      </ul>
    )
  }
  return (
    <ul className={compact ? COMPACT_TILES : TILES}>
      {add ? <AddItem add={add} layout="tiles" /> : null}
      {notebooks.map((notebook) => (
        <NotebookCard key={notebook.id} {...props(notebook)} />
      ))}
    </ul>
  )
}

/** What dragging a selected item carries: every selected item, when there are several. */
function carried(
  selection: LibrarySelection | null,
  id: string,
  label: (id: string) => string | undefined,
): { id: string; label: string }[] | undefined {
  if (!selection?.has(id) || selection.ids.length < 2) return undefined
  return selection.ids.map((i) => ({ id: i, label: label(i) ?? '' }))
}
