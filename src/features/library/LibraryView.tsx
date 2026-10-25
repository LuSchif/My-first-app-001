import { FolderPlus, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog, DialogTrigger } from '../../design/index.ts'
import { FolderEditorDialog } from '../folders/FolderEditorDialog.tsx'
import { CalendarHome } from '../calendar/CalendarHome.tsx'
import { AppearanceMenu } from './AppearanceMenu.tsx'
import { DragGhost } from './DragGhost.tsx'
import { FolderGrid, NotebookGrid } from './Grids.tsx'
import {
  FOLDER_SORTS,
  NOTEBOOK_SORTS,
  sortFolders,
  sortNotebooks,
  type FolderSort,
  type NotebookSort,
} from './librarySort.ts'
import { BackupMenu, InstallHint } from './KeepSafe.tsx'
import { NewNotebookDialog } from './NewNotebookDialog.tsx'
import { SortMenu } from './SortMenu.tsx'
import { useLibrary, type Library } from './useLibrary.ts'
import { useStoredState } from './useStoredState.ts'

const RECENT_COUNT = 6
const FILTERS = [
  ['unfiled', 'Not in a folder'],
  ['all', 'All notebooks'],
] as const

/**
 * The dashboard: search, the folders, the most recently edited notebooks, and the notebooks
 * that are in no folder (or all of them). Folders and notebooks can be sorted and filtered.
 */
export function LibraryView() {
  const { library, error, reload } = useLibrary()
  const [query, setQuery] = useState('')
  const open = (id: string) => navigate({ name: 'notebook', id })

  return (
    <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Broomit</h1>
          <div className="flex flex-wrap gap-2">
            <AppearanceMenu />
            <BackupMenu onRestored={reload} />
            <NewFolderButton reload={reload} />
            <NewNotebookButton library={library} reload={reload} onCreated={open} />
          </div>
        </header>

        <CalendarHome />

        <SearchField value={query} onChange={setQuery} />

        <InstallHint />

        {error ? (
          <p className="text-danger">
            Your notebooks could not be loaded. Reload the page; if it keeps happening, this browser
            may be blocking storage.
          </p>
        ) : library === null ? null : query.trim() ? (
          <SearchResults query={query.trim()} library={library} reload={reload} />
        ) : library.folders.length === 0 && library.notebooks.length === 0 ? (
          <EmptyState library={library} reload={reload} onCreated={open} />
        ) : (
          <Dashboard library={library} reload={reload} />
        )}

        <footer className="flex gap-4 pt-6 text-sm text-ink-muted">
          <a href="./design.html" className="underline-offset-4 hover:underline">
            Design system
          </a>
          <a href="./ink-test.html" className="underline-offset-4 hover:underline">
            Ink test
          </a>
        </footer>
      </div>
      <DragGhost />
    </div>
  )
}

function Dashboard({ library, reload }: { library: Library; reload: () => void }) {
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
  const [filter, setFilter] = useStoredState<'unfiled' | 'all'>(
    'broomit.notebookFilter',
    'unfiled',
    FILTERS.map(([v]) => v),
  )
  const recent = sortNotebooks(library.notebooks, 'recent').slice(0, RECENT_COUNT)
  const topFolders = sortFolders(
    library.folders.filter((f) => f.parentId === null),
    folderSort,
    library,
  )
  const notebooks = sortNotebooks(
    filter === 'all' ? library.notebooks : library.notebooks.filter((n) => n.folderId === null),
    notebookSort,
  )

  return (
    <>
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
          folders={topFolders}
          library={library}
          sortable={folderSort === 'custom'}
          reload={reload}
          newFolderParent={null}
        />
      </Section>

      {library.folders.length > 0 && recent.length > 0 ? (
        <Section title="Recent">
          <NotebookGrid notebooks={recent} library={library} reload={reload} />
        </Section>
      ) : null}

      <Section
        title="Notebooks"
        // Dropping a notebook here takes it out of its folder.
        drop="root"
        actions={
          <>
            <SortMenu label="Show" value={filter} options={FILTERS} onChange={setFilter} />
            <SortMenu
              label="Sort notebooks"
              value={notebookSort}
              options={NOTEBOOK_SORTS}
              onChange={setNotebookSort}
            />
          </>
        }
      >
        {notebooks.length ? (
          <NotebookGrid notebooks={notebooks} library={library} reload={reload} />
        ) : (
          <p className="rounded-card px-4 py-8 text-center text-sm text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
            {filter === 'unfiled' && library.notebooks.length > 0
              ? 'Every notebook is in a folder. Drop one here to take it out.'
              : 'No notebooks yet.'}
          </p>
        )}
      </Section>
    </>
  )
}

function SearchResults({
  query,
  library,
  reload,
}: {
  query: string
  library: Library
  reload: () => void
}) {
  const q = query.toLocaleLowerCase()
  const folders = library.folders.filter((f) => f.name.toLocaleLowerCase().includes(q))
  const notebooks = sortNotebooks(
    library.notebooks.filter((n) => n.title.toLocaleLowerCase().includes(q)),
    'recent',
  )
  if (!folders.length && !notebooks.length) {
    return <p className="py-8 text-center text-ink-muted">Nothing matches “{query}”.</p>
  }
  return (
    <>
      {folders.length ? (
        <Section title={`Folders (${folders.length})`}>
          <FolderGrid folders={folders} library={library} sortable={false} reload={reload} />
        </Section>
      ) : null}
      {notebooks.length ? (
        <Section title={`Notebooks (${notebooks.length})`}>
          <NotebookGrid notebooks={notebooks} library={library} reload={reload} />
        </Section>
      ) : null}
    </>
  )
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search
        size={18}
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
      />
      <input
        type="search"
        aria-label="Search folders and notebooks"
        placeholder="Search folders and notebooks"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-full bg-surface-raised pr-12 pl-11 shadow-soft ring-1 ring-line ring-inset placeholder:text-ink-subtle focus:ring-2 focus:ring-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-hover"
        >
          <X size={18} />
        </button>
      ) : null}
    </div>
  )
}

function EmptyState({
  library,
  reload,
  onCreated,
}: {
  library: Library
  reload: () => void
  onCreated: (id: string) => void
}) {
  return (
    <div className="grid justify-items-center gap-4 rounded-panel bg-surface-raised px-6 py-16 text-center shadow-soft">
      <p className="text-xl font-bold">No notebooks yet</p>
      <p className="max-w-[44ch] text-ink-muted">
        Create a folder for each subject or project, then a notebook in it, and start writing with
        your pencil.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <NewFolderButton reload={reload} />
        <NewNotebookButton library={library} reload={reload} onCreated={onCreated} />
      </div>
    </div>
  )
}

/** A titled part of the library, with its own sort and filter menus on the right. */
export function Section({
  title,
  actions,
  drop,
  children,
}: {
  title: string
  actions?: React.ReactNode
  /** Makes the whole section a place to drop notebooks and folders out of their folder. */
  drop?: 'root'
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4" {...(drop ? { 'data-drop': drop } : {})}>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          {title}
        </h2>
        {actions ? <div className="flex flex-wrap gap-1">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function NewFolderButton({
  reload,
  parentId = null,
  label = 'New folder',
}: {
  reload: () => void
  parentId?: string | null
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button icon={<FolderPlus size={18} />}>{label}</Button>
      </DialogTrigger>
      {open ? (
        <FolderEditorDialog
          parentId={parentId}
          onSaved={() => {
            setOpen(false)
            reload()
          }}
        />
      ) : null}
    </Dialog>
  )
}

export function NewNotebookButton({
  library,
  reload,
  onCreated,
  folderId = null,
}: {
  library: Library | null
  reload: () => void
  onCreated: (id: string) => void
  folderId?: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" icon={<Plus size={18} />}>
          New notebook
        </Button>
      </DialogTrigger>
      {open ? (
        <NewNotebookDialog
          folders={library?.folders ?? []}
          folderId={folderId}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  )
}
