import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import type { Folder, Id, Notebook } from '../../engine/model/types.ts'
import { Dialog, DialogTrigger } from '../../design/index.ts'
import { FolderCard, FolderRow } from '../folders/FolderCard.tsx'
import { FolderEditorDialog } from '../folders/FolderEditorDialog.tsx'
import { useDrop } from './librarySort.ts'
import type { LibraryLayout } from './libraryLayout.ts'
import { NotebookCard, NotebookRow } from './NotebookCard.tsx'
import type { Library } from './useLibrary.ts'

/** The list view's frame: rows on one card, divided by lines. */
const LIST =
  'grid divide-y divide-line overflow-hidden rounded-card bg-surface-raised ring-1 ring-line'

/**
 * Folders as tiles (one at a time shows its preview, with a "New folder" tile at the end) or
 * as a list.
 */
export function FolderGrid({
  folders,
  library,
  sortable,
  reload,
  newFolderParent,
  layout = 'tiles',
}: {
  folders: Folder[]
  library: Library
  sortable: boolean
  reload: () => void
  /** Where the "New folder" tile creates folders; leave out for no tile. */
  newFolderParent?: Id | null
  layout?: LibraryLayout
}) {
  const [preview, setPreview] = useState<Id | null>(null)
  const drop = useDrop(library, reload)
  if (layout === 'list') {
    if (!folders.length && newFolderParent === undefined) return null
    return (
      <ul className={LIST}>
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            folders={library.folders}
            notebooks={library.notebooks}
            onOpenFolder={() => navigate({ name: 'folder', id: folder.id })}
            onChanged={reload}
            onDrop={drop({ kind: 'folder', id: folder.id, label: folder.name })}
            sortable={sortable}
          />
        ))}
        {newFolderParent !== undefined ? (
          <NewFolderItem parentId={newFolderParent} reload={reload} layout="list" />
        ) : null}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] items-start gap-x-5 gap-y-7">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          folders={library.folders}
          notebooks={library.notebooks}
          previewOpen={preview === folder.id}
          onPreview={(open) => setPreview(open ? folder.id : null)}
          onOpenFolder={() => navigate({ name: 'folder', id: folder.id })}
          onOpenNotebook={(id) => navigate({ name: 'notebook', id })}
          onChanged={reload}
          onDrop={drop({ kind: 'folder', id: folder.id, label: folder.name })}
          sortable={sortable}
        />
      ))}
      {newFolderParent !== undefined ? (
        <NewFolderItem parentId={newFolderParent} reload={reload} layout="tiles" />
      ) : null}
    </ul>
  )
}

/** A dashed "New folder" tile, or the last row of the list. */
function NewFolderItem({
  parentId,
  reload,
  layout,
}: {
  parentId: Id | null
  reload: () => void
  layout: LibraryLayout
}) {
  const [creating, setCreating] = useState(false)
  return (
    <li className="grid min-w-0">
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogTrigger asChild>
          {layout === 'tiles' ? (
            <button
              type="button"
              className="grid aspect-[6/5] w-full place-content-center justify-items-center gap-2 rounded-card text-sm font-semibold text-ink-muted ring-2 ring-line ring-inset [border-style:dashed] hover:bg-hover"
            >
              <FolderPlus size={24} />
              New folder
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-3 px-3 py-3 text-left text-sm font-semibold text-ink-muted hover:bg-hover"
            >
              <span className="grid w-12 place-items-center">
                <FolderPlus size={22} />
              </span>
              New folder
            </button>
          )}
        </DialogTrigger>
        {creating ? (
          <FolderEditorDialog
            parentId={parentId}
            onSaved={() => {
              setCreating(false)
              reload()
            }}
          />
        ) : null}
      </Dialog>
    </li>
  )
}

/** Notebooks as tiles or as a list. */
export function NotebookGrid({
  notebooks,
  library,
  reload,
  layout = 'tiles',
}: {
  notebooks: Notebook[]
  library: Library
  reload: () => void
  layout?: LibraryLayout
}) {
  const drop = useDrop(library, reload)
  if (layout === 'list') {
    return (
      <ul className={LIST}>
        {notebooks.map((notebook) => (
          <NotebookRow
            key={notebook.id}
            notebook={notebook}
            folders={library.folders}
            onOpen={() => navigate({ name: 'notebook', id: notebook.id })}
            onChanged={reload}
            onDrop={drop({ kind: 'notebook', id: notebook.id, label: notebook.title })}
          />
        ))}
      </ul>
    )
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] items-start gap-x-5 gap-y-7">
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          notebook={notebook}
          folders={library.folders}
          onOpen={() => navigate({ name: 'notebook', id: notebook.id })}
          onChanged={reload}
          onDrop={drop({ kind: 'notebook', id: notebook.id, label: notebook.title })}
        />
      ))}
    </ul>
  )
}
