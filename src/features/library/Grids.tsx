import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import type { Folder, Id, Notebook } from '../../engine/model/types.ts'
import { Dialog, DialogTrigger } from '../../design/index.ts'
import { FolderCard } from '../folders/FolderCard.tsx'
import { FolderEditorDialog } from '../folders/FolderEditorDialog.tsx'
import { useDrop } from './librarySort.ts'
import { NotebookCard } from './NotebookCard.tsx'
import type { Library } from './useLibrary.ts'

/** Folders in a grid; one at a time shows its preview. Ends with a "New folder" tile. */
export function FolderGrid({
  folders,
  library,
  sortable,
  reload,
  newFolderParent,
}: {
  folders: Folder[]
  library: Library
  sortable: boolean
  reload: () => void
  /** Where the "New folder" tile creates folders; leave out for no tile. */
  newFolderParent?: Id | null
}) {
  const [preview, setPreview] = useState<Id | null>(null)
  const [creating, setCreating] = useState(false)
  const drop = useDrop(library, reload)
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
        <li className="grid min-w-0">
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="grid aspect-[6/5] w-full place-content-center justify-items-center gap-2 rounded-card text-sm font-semibold text-ink-muted ring-2 ring-line ring-inset [border-style:dashed] hover:bg-hover"
              >
                <FolderPlus size={24} />
                New folder
              </button>
            </DialogTrigger>
            {creating ? (
              <FolderEditorDialog
                parentId={newFolderParent}
                onSaved={() => {
                  setCreating(false)
                  reload()
                }}
              />
            ) : null}
          </Dialog>
        </li>
      ) : null}
    </ul>
  )
}

/** Notebooks in a grid. */
export function NotebookGrid({
  notebooks,
  library,
  reload,
}: {
  notebooks: Notebook[]
  library: Library
  reload: () => void
}) {
  const drop = useDrop(library, reload)
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
