import { releaseLabel } from '../../release.ts'
import {
  ChevronRight,
  FolderPlus,
  Layers,
  NotebookPen,
  Plus,
  Presentation,
  Search,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog, DialogTrigger } from '../../design/index.ts'
import { Carousel, type CarouselPage } from './Carousel.tsx'
import { FolderDropStrip } from './FolderDropStrip.tsx'
import { PeekLayer } from './Peek.tsx'
import { NewDeckDialog } from '../flashcards/NewDeckDialog.tsx'
import type { DocumentKind } from '../../engine/model/types.ts'
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

/**
 * The home screen: today's calendar on the left; on the right, buttons for a new folder,
 * notebook or presentation, and below them a carousel of the folders, the notebooks (in no
 * folder, or all of them) and the presentations. Everything shows as tiles or as a list.
 */
export function LibraryView() {
  const { library, error, reload } = useLibrary()
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useLibraryLayout()
  const open = (id: string) => navigate({ name: 'notebook', id })
  const searching = query.trim() !== ''

  return (
    <div className="min-h-full px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-16 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="mr-2 text-3xl font-bold tracking-tight">Broomit</h1>
          <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-[14rem] sm:flex-1">
            <SearchField value={query} onChange={setQuery} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <AppearanceMenu />
            <BackupMenu onRestored={reload} />
          </div>
        </header>

        <InstallHint />

        {/* Today on the left; creating and browsing beside it, both as tall as the screen allows. */}
        <div className="grid gap-6 md:h-[clamp(30rem,calc(100dvh-12rem),64rem)] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <CalendarHome todayOnly className="h-[28rem] md:h-full" />
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            {error ? (
              <p className="text-danger">
                Your notebooks could not be loaded. Reload the page; if it keeps happening, this
                browser may be blocking storage.
              </p>
            ) : library === null ? null : searching ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-panel bg-surface-raised p-4 shadow-soft ring-1 ring-line">
                <div className="grid gap-6">
                  <SearchResults
                    query={query.trim()}
                    library={library}
                    reload={reload}
                    layout={layout}
                  />
                </div>
              </div>
            ) : (
              <Browser library={library} reload={reload} layout={layout} onCreated={open} />
            )}
          </div>
        </div>

        <footer className="flex gap-4 pt-6 text-sm text-ink-muted">
          <a href="./design.html" className="underline-offset-4 hover:underline">
            Design system
          </a>
          <a href="./ink-test.html" className="underline-offset-4 hover:underline">
            Ink test
          </a>
          <span className="ml-auto font-semibold">{releaseLabel()}</span>
        </footer>
      </div>
      {library ? <PeekLayer library={library} reload={reload} /> : null}
      <DragGhost />
    </div>
  )
}

const PAGES = ['create', 'folders', 'notebooks', 'presentations', 'flashcards'] as const

/** The folders, the notebooks and the presentations, one page of the carousel each. */
function Browser({
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
  const [creating, setCreating] = useState<Creating>(null)
  const [page, setPage] = useStoredState<(typeof PAGES)[number]>(
    'broomit.libraryPage',
    // The first page anyone sees: what they can make.
    'create',
    PAGES,
  )
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
  const topFolders = sortFolders(
    library.folders.filter((f) => f.parentId === null),
    folderSort,
    library,
  )
  // Every notebook, presentation and deck on the device, wherever it is filed.
  const ofKind = (kind: DocumentKind) =>
    sortNotebooks(
      library.notebooks.filter((n) => (n.kind ?? 'notebook') === kind),
      notebookSort,
    )
  const sortMenu = (label: string) => (
    <SortMenu
      label={label}
      value={notebookSort}
      options={NOTEBOOK_SORTS}
      onChange={setNotebookSort}
    />
  )
  const documents = (kind: DocumentKind, add: string, empty: string): React.ReactNode => {
    const list = ofKind(kind)
    return (
      <>
        {list.length === 0 ? <p className="mb-4 text-sm text-ink-muted">{empty}</p> : null}
        <NotebookGrid
          notebooks={list}
          library={library}
          reload={reload}
          layout={layout}
          showFolder
          add={{ label: add, onAdd: () => setCreating(kind) }}
        />
      </>
    )
  }

  const pages: CarouselPage[] = [
    {
      key: 'create',
      title: 'Create',
      content: (
        <ul className="grid gap-3">
          {CREATE_OPTIONS.map(([kind, title, text, icon]) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => setCreating(kind)}
                className="flex w-full items-center gap-4 rounded-card bg-surface p-4 text-left ring-1 ring-line transition-transform duration-150 ease-gentle hover:bg-surface-sunken active:scale-[0.99]"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-control bg-ink text-ink-inverse shadow-soft">
                  {icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">{title}</span>
                  <span className="block text-sm text-ink-muted">{text}</span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'folders',
      title: 'Folders',
      actions: (
        <SortMenu
          label="Sort folders"
          value={folderSort}
          options={FOLDER_SORTS}
          onChange={setFolderSort}
        />
      ),
      content: (
        <>
          {topFolders.length === 0 ? (
            <p className="mb-4 text-sm text-ink-muted">
              No folders yet. Make one for each subject.
            </p>
          ) : null}
          <FolderGrid
            folders={topFolders}
            library={library}
            sortable={folderSort === 'custom'}
            reload={reload}
            layout={layout}
            add={{ label: 'New folder', onAdd: () => setCreating('folder') }}
          />
        </>
      ),
    },
    {
      key: 'notebooks',
      title: 'Notebooks',
      actions: sortMenu('Sort notebooks'),
      content: documents('notebook', 'New notebook', 'No notebooks yet.'),
    },
    {
      key: 'presentations',
      title: 'Presentations',
      actions: sortMenu('Sort presentations'),
      content: documents('presentation', 'New presentation', 'No presentations yet.'),
    },
    {
      key: 'flashcards',
      title: 'Flashcards',
      actions: sortMenu('Sort flashcards'),
      content: documents(
        'deck',
        'New flashcards',
        'No flashcards yet. Make a deck, write on its cards with your pencil, then study it.',
      ),
    },
  ]
  return (
    <>
      <Carousel
        pages={pages}
        index={PAGES.indexOf(page)}
        onIndex={(i) => setPage(PAGES[i] ?? 'create')}
        // A held notebook, presentation or deck can be dropped into any folder from here.
        overlay={<FolderDropStrip folders={library.folders} notebooks={library.notebooks} />}
        className="min-h-[28rem] flex-1"
      />
      <Creator
        creating={creating}
        onDone={() => setCreating(null)}
        library={library}
        reload={reload}
        onCreated={onCreated}
      />
    </>
  )
}

/** What the Create page makes, in this order. */
const CREATE_OPTIONS: [NonNullable<Creating>, string, string, React.ReactNode][] = [
  [
    'notebook',
    'Notebook',
    'Pages to write and draw on with your pencil, on the paper you choose.',
    <NotebookPen key="n" size={26} />,
  ],
  [
    'folder',
    'Folder',
    'Keep notebooks, presentations and flashcards together, e.g. one folder per subject.',
    <FolderPlus key="f" size={26} />,
  ],
  [
    'presentation',
    'Presentation',
    'Slides made with the same pens and tools, with animations, presented full screen.',
    <Presentation key="p" size={26} />,
  ],
  [
    'deck',
    'Flashcards',
    'Cards with a front and a back. Study them: what you know comes back later, what you don’t comes again soon.',
    <Layers key="d" size={26} />,
  ],
]

type Creating = DocumentKind | 'folder' | null

/** The dialog that makes a new folder, notebook or presentation. */
function Creator({
  creating,
  onDone,
  library,
  reload,
  onCreated,
}: {
  creating: Creating
  onDone: () => void
  library: Library
  reload: () => void
  onCreated: (id: string) => void
}) {
  return (
    <Dialog open={creating !== null} onOpenChange={(o) => !o && onDone()}>
      {creating === 'notebook' ? (
        <NewNotebookDialog
          folders={library.folders}
          folderId={null}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : creating === 'presentation' ? (
        <NewPresentationDialog
          folders={library.folders}
          folderId={null}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : creating === 'deck' ? (
        <NewDeckDialog
          folders={library.folders}
          folderId={null}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : creating === 'folder' ? (
        <FolderEditorDialog
          parentId={null}
          onSaved={() => {
            onDone()
            reload()
          }}
        />
      ) : null}
    </Dialog>
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

export function NewDeckButton({
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
        <Button icon={<Layers size={18} />}>New flashcards</Button>
      </DialogTrigger>
      {open ? (
        <NewDeckDialog
          folders={library?.folders ?? []}
          folderId={folderId}
          onFoldersChanged={reload}
          onCreated={onCreated}
        />
      ) : null}
    </Dialog>
  )
}
