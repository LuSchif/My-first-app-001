import { FolderPlus, NotebookPen, Plus, Presentation, Search, X } from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import {
  Button,
  Dialog,
  DialogTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../design/index.ts'
import type { Notebook } from '../../engine/model/types.ts'
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
import { NewPresentationDialog } from './NewPresentationDialog.tsx'
import { SortMenu } from './SortMenu.tsx'
import { useLibrary, type Library } from './useLibrary.ts'
import { useStoredState } from './useStoredState.ts'
import { LayoutToggle } from './LayoutToggle.tsx'
import { useLibraryLayout, type LibraryLayout } from './libraryLayout.ts'

const FILTERS = [
  ['unfiled', 'Not in a folder'],
  ['all', 'All notebooks'],
] as const

/**
 * The home screen: today's calendar at the top left; beside it the folders and the notebooks
 * that are in no folder (or all of them), sorted and filtered as chosen; below, the
 * presentations. Everything shows as tiles or as a list.
 */
export function LibraryView() {
  const { library, error, reload } = useLibrary()
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useLibraryLayout()
  const open = (id: string) => navigate({ name: 'notebook', id })
  const empty = library !== null && library.folders.length === 0 && library.notebooks.length === 0
  const searching = query.trim() !== ''

  return (
    <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="mr-2 text-3xl font-bold tracking-tight">Broomit</h1>
          <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-[14rem] sm:flex-1">
            <SearchField value={query} onChange={setQuery} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <AppearanceMenu />
            <BackupMenu onRestored={reload} />
            <NewMenu library={library} reload={reload} onCreated={open} />
          </div>
        </header>

        <InstallHint />

        {/* Today on the left; the folders and notebooks beside it. */}
        <div className="grid items-start gap-8 md:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
          <aside className="md:sticky md:top-[calc(1.5rem+env(safe-area-inset-top))]">
            <CalendarHome todayOnly />
          </aside>
          <div className="grid min-w-0 gap-8">
            {error ? (
              <p className="text-danger">
                Your notebooks could not be loaded. Reload the page; if it keeps happening, this
                browser may be blocking storage.
              </p>
            ) : library === null ? null : searching ? (
              <SearchResults
                query={query.trim()}
                library={library}
                reload={reload}
                layout={layout}
              />
            ) : empty ? (
              <EmptyState library={library} reload={reload} onCreated={open} />
            ) : (
              <Dashboard library={library} reload={reload} layout={layout} />
            )}
          </div>
        </div>

        {/* Below: everything else. */}
        {library && !searching && !empty ? (
          <Presentations library={library} reload={reload} layout={layout} onCreated={open} />
        ) : null}

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

const isPresentation = (n: Notebook) => n.kind === 'presentation'

function Dashboard({
  library,
  reload,
  layout,
}: {
  library: Library
  reload: () => void
  layout: LibraryLayout
}) {
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
  const topFolders = sortFolders(
    library.folders.filter((f) => f.parentId === null),
    folderSort,
    library,
  )
  const all = library.notebooks.filter((n) => !isPresentation(n))
  const notebooks = sortNotebooks(
    filter === 'all' ? all : all.filter((n) => n.folderId === null),
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
          layout={layout}
        />
      </Section>

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
          <NotebookGrid notebooks={notebooks} library={library} reload={reload} layout={layout} />
        ) : (
          <p className="rounded-card px-4 py-8 text-center text-sm text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
            {filter === 'unfiled' && all.length > 0
              ? 'Every notebook is in a folder. Drop one here to take it out.'
              : 'No notebooks yet.'}
          </p>
        )}
      </Section>
    </>
  )
}

/** Every presentation, wherever it is filed, most recently edited first. */
function Presentations({
  library,
  reload,
  layout,
  onCreated,
}: {
  library: Library
  reload: () => void
  layout: LibraryLayout
  onCreated: (id: string) => void
}) {
  const presentations = sortNotebooks(library.notebooks.filter(isPresentation), 'recent')
  return (
    <Section
      title="Presentations"
      actions={<NewPresentationButton library={library} reload={reload} onCreated={onCreated} />}
    >
      {presentations.length ? (
        <NotebookGrid notebooks={presentations} library={library} reload={reload} layout={layout} />
      ) : (
        <p className="rounded-card px-4 py-8 text-center text-sm text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
          No presentations yet. Make slides with the same pens and tools, then present them.
        </p>
      )}
    </Section>
  )
}

/** One button for everything new: a notebook, a presentation or a folder. */
function NewMenu({
  library,
  reload,
  onCreated,
}: {
  library: Library | null
  reload: () => void
  onCreated: (id: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const [creating, setCreating] = useState<'notebook' | 'presentation' | 'folder' | null>(null)
  const item =
    'flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-semibold hover:bg-hover'
  const pick = (kind: 'notebook' | 'presentation' | 'folder') => {
    setMenu(false)
    setCreating(kind)
  }
  return (
    <>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <Button variant="primary" icon={<Plus size={18} />}>
            New
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="grid w-64 gap-0.5 p-1.5">
          <button type="button" className={item} onClick={() => pick('notebook')}>
            <NotebookPen size={18} /> Notebook
          </button>
          <button type="button" className={item} onClick={() => pick('presentation')}>
            <Presentation size={18} /> Presentation
          </button>
          <button type="button" className={item} onClick={() => pick('folder')}>
            <FolderPlus size={18} /> Folder
          </button>
        </PopoverContent>
      </Popover>
      <Dialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        {creating === 'notebook' ? (
          <NewNotebookDialog
            folders={library?.folders ?? []}
            folderId={null}
            onFoldersChanged={reload}
            onCreated={onCreated}
          />
        ) : creating === 'presentation' ? (
          <NewPresentationDialog
            folders={library?.folders ?? []}
            folderId={null}
            onFoldersChanged={reload}
            onCreated={onCreated}
          />
        ) : creating === 'folder' ? (
          <FolderEditorDialog
            parentId={null}
            onSaved={() => {
              setCreating(null)
              reload()
            }}
          />
        ) : null}
      </Dialog>
    </>
  )
}

function SearchResults({
  query,
  library,
  reload,
  layout,
}: {
  query: string
  library: Library
  reload: () => void
  layout: LibraryLayout
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
          <FolderGrid
            folders={folders}
            library={library}
            sortable={false}
            reload={reload}
            layout={layout}
          />
        </Section>
      ) : null}
      {notebooks.length ? (
        <Section title={`Notebooks (${notebooks.length})`}>
          <NotebookGrid notebooks={notebooks} library={library} reload={reload} layout={layout} />
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
        <NewPresentationButton library={library} reload={reload} onCreated={onCreated} />
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

export function NewPresentationButton({
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
        <Button icon={<Presentation size={18} />}>New presentation</Button>
      </DialogTrigger>
      {open ? (
        <NewPresentationDialog
          folders={library?.folders ?? []}
          folderId={folderId}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  )
}
