import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog, DialogTrigger, IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { DragGhost } from '../library/DragGhost.tsx'
import { useDragState } from '../library/dragDrop.ts'
import { FolderGrid, NotebookGrid } from '../library/Grids.tsx'
import {
  FOLDER_SORTS,
  NOTEBOOK_SORTS,
  sortFolders,
  sortNotebooks,
  type FolderSort,
  type NotebookSort,
} from '../library/librarySort.ts'
import { folderPath } from '../library/libraryActions.ts'
import {
  NewFolderButton,
  NewNotebookButton,
  NewPresentationButton,
  Section,
} from '../library/LibraryView.tsx'
import { SortMenu } from '../library/SortMenu.tsx'
import { useLibrary } from '../library/useLibrary.ts'
import { useStoredState } from '../library/useStoredState.ts'
import { LayoutToggle } from '../library/LayoutToggle.tsx'
import { useLibraryLayout } from '../library/libraryLayout.ts'
import { FolderEditorDialog } from './FolderEditorDialog.tsx'
import { FolderGraphic } from './FolderGraphic.tsx'

/** Everything in one folder: its folders and all its notebooks. */
export function FolderView({ id }: { id: string }) {
  const { library, error, reload } = useLibrary()
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useLibraryLayout()
  const [folderSort, setFolderSort] = useStoredState<FolderSort>(
    'broomit.folderSort',
    'custom',
    FOLDER_SORTS.map(([v]) => v),
  )
  const [notebookSort, setNotebookSort] = useStoredState<NotebookSort>(
    'broomit.notebookSort',
    'recent',
    NOTEBOOK_SORTS.map(([v]) => v),
  )
  if (error) {
    return <p className="p-8 text-danger">Your notebooks could not be loaded. Reload the page.</p>
  }
  if (!library) return null
  const folder = library.folders.find((f) => f.id === id)
  if (!folder) {
    return (
      <div className="grid justify-items-center gap-4 p-16 text-center">
        <p className="text-xl font-bold">This folder no longer exists</p>
        <Button onClick={() => navigate({ name: 'library' })}>Back to the library</Button>
      </div>
    )
  }
  const path = folderPath(library.folders, folder.id)
  const parent = path.length > 1 ? path[path.length - 2]! : null
  const subfolders = sortFolders(
    library.folders.filter((f) => f.parentId === folder.id),
    folderSort,
    library,
  )
  const notebooks = sortNotebooks(
    library.notebooks.filter((n) => n.folderId === folder.id),
    notebookSort,
  )

  return (
    <div className="min-h-full px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-8">
        <nav aria-label="Folder path" className="flex flex-wrap items-center gap-1 text-sm">
          <IconButton
            label={parent ? `Back to ${parent.name}` : 'Back to the library'}
            icon={<ChevronLeft size={22} />}
            onClick={() =>
              navigate(parent ? { name: 'folder', id: parent.id } : { name: 'library' })
            }
          />
          <Crumb
            label="Library"
            drop={{ kind: 'root' }}
            onOpen={() => navigate({ name: 'library' })}
          />
          {path.map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-ink-subtle" />
              <Crumb
                label={f.name}
                current={f.id === folder.id}
                drop={{ kind: 'folder', id: f.id }}
                onOpen={() => navigate({ name: 'folder', id: f.id })}
              />
            </span>
          ))}
        </nav>

        <header className="flex flex-wrap items-center gap-5">
          <FolderGraphic fill={folder.fill} icon={folder.icon} className="w-24 shrink-0" />
          <div className="grid min-w-0 flex-1 gap-1">
            <h1 className="truncate text-3xl font-bold tracking-tight">{folder.name}</h1>
            <p className="text-ink-muted">
              {notebooks.length} {notebooks.length === 1 ? 'notebook' : 'notebooks'}
              {subfolders.length
                ? ` · ${subfolders.length} ${subfolders.length === 1 ? 'folder' : 'folders'}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <Dialog open={editing} onOpenChange={setEditing}>
              <DialogTrigger asChild>
                <Button icon={<Pencil size={18} />}>Edit</Button>
              </DialogTrigger>
              {editing ? (
                <FolderEditorDialog
                  folder={folder}
                  onSaved={() => {
                    setEditing(false)
                    reload()
                  }}
                />
              ) : null}
            </Dialog>
            <NewFolderButton reload={reload} parentId={folder.id} label="New folder" />
            <NewPresentationButton
              library={library}
              reload={reload}
              folderId={folder.id}
              onCreated={(nb) => navigate({ name: 'notebook', id: nb })}
            />
            <NewNotebookButton
              library={library}
              reload={reload}
              folderId={folder.id}
              onCreated={(nb) => navigate({ name: 'notebook', id: nb })}
            />
          </div>
        </header>

        {subfolders.length ? (
          <Section
            title="Folders"
            actions={
              <SortMenu
                label="Sort folders"
                value={folderSort}
                options={FOLDER_SORTS}
                onChange={setFolderSort}
              />
            }
          >
            <FolderGrid
              folders={subfolders}
              library={library}
              sortable={folderSort === 'custom'}
              reload={reload}
              layout={layout}
            />
          </Section>
        ) : null}

        <Section
          title="Notebooks"
          actions={
            <SortMenu
              label="Sort notebooks"
              value={notebookSort}
              options={NOTEBOOK_SORTS}
              onChange={setNotebookSort}
            />
          }
        >
          {notebooks.length ? (
            <NotebookGrid notebooks={notebooks} library={library} reload={reload} layout={layout} />
          ) : (
            <p className="rounded-card px-4 py-10 text-center text-sm text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
              No notebooks here yet. Create one, or drag one onto this folder in the library.
            </p>
          )}
        </Section>
      </div>
      <DragGhost />
    </div>
  )
}

/** A step of the folder path; also a place to drop notebooks and folders into. */
function Crumb({
  label,
  current,
  drop,
  onOpen,
}: {
  label: string
  current?: boolean
  drop: { kind: 'root' } | { kind: 'folder'; id: string }
  onOpen: () => void
}) {
  const drag = useDragState()
  const over =
    drag?.over &&
    (drop.kind === 'root'
      ? drag.over.kind === 'root'
      : drag.over.kind === 'folder' && drag.over.id === drop.id)
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      data-drop={drop.kind}
      {...(drop.kind === 'folder' ? { 'data-drop-id': drop.id } : {})}
      onClick={onOpen}
      className={cn(
        'max-w-[14rem] truncate rounded-control px-2.5 py-1.5 font-semibold hover:bg-hover',
        current ? 'text-ink' : 'text-ink-muted',
        over && 'bg-accent text-ink-inverse',
      )}
    >
      {label}
    </button>
  )
}
