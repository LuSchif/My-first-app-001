import { releaseLabel } from '../../release.ts'
import {
  ChevronRight,
  FolderPlus,
  Gamepad2,
  Layers,
  NotebookPen,
  Plus,
  Presentation,
  Search,
  Store,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, Dialog, DialogTrigger } from '../../design/index.ts'
import { Carousel, type CarouselPage } from './Carousel.tsx'
import { FolderDropStrip } from './FolderDropStrip.tsx'
import { PeekLayer } from './Peek.tsx'
import { NewDeckDialog } from '../flashcards/NewDeckDialog.tsx'
import { NewQuizDialog } from '../quiz/NewQuizDialog.tsx'
import type { DocumentKind, Folder, Notebook } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { arrange, type HomeGroup, type HomeTab, type HomeTabKey } from './homeTabs.ts'
import { makeOrganizer, OrganizerProvider, useHomeTabs } from './organizer.ts'
import { GroupSection, NewGroupButton, PinnedSection } from './TabSections.tsx'
import { SelectButton, SelectionBar } from './SelectionBar.tsx'
import { SelectionProvider, type LibrarySelection } from './librarySelection.ts'
import { FolderEditorDialog } from '../folders/FolderEditorDialog.tsx'
import { CalendarHome } from '../calendar/CalendarHome.tsx'
import { AppearanceMenu } from './AppearanceMenu.tsx'
import { ProfileButton } from '../profile/ProfileButton.tsx'
import { DragGhost } from './DragGhost.tsx'
import { FolderGrid, NotebookGrid, type AddAction } from './Grids.tsx'
import {
  FOLDER_SORTS,
  NOTEBOOK_SORTS,
  makeDrop,
  moveMany,
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
          <h1 className="mr-2 text-3xl font-bold tracking-tight">
            Broom<span className="brand-it">it</span>
          </h1>
          <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-[14rem] sm:flex-1">
            <SearchField value={query} onChange={setQuery} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LayoutToggle value={layout} onChange={setLayout} />
            <AppearanceMenu />
            <BackupMenu onRestored={reload} />
            <ProfileButton />
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

const PAGES = ['create', 'folders', 'notebooks', 'presentations', 'flashcards', 'quizzes'] as const

/**
 * The carousel: Create, then folders, notebooks, presentations and flashcards. Each of those
 * pages has its pinned items and its groups at the top; a group can also be a page of its own,
 * right after its page.
 */
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
  const { tabs, change } = useHomeTabs()
  /** The page on screen, which may be a group's own page. */
  const [shown, setShown] = useState<string | null>(null)
  /** Choosing several items on one page. */
  const [selecting, setSelecting] = useState<{ page: string; ids: string[] } | null>(null)
  /** What each page holds, for the selection bar. */
  const pageItems = new Map<
    string,
    { kind: 'folder' | 'notebook'; tab: HomeTabKey; items: { id: string; label: string }[] }
  >()
  const clearSelection = () => setSelecting(null)
  /** A page's content, choosable while selecting there. */
  const selectable = (page: string, content: React.ReactNode) => {
    if (selecting?.page !== page) return content
    const value: LibrarySelection = {
      ids: selecting.ids,
      has: (id) => selecting.ids.includes(id),
      toggle: (id) =>
        setSelecting((cur) =>
          cur && cur.page === page
            ? {
                page,
                ids: cur.ids.includes(id) ? cur.ids.filter((i) => i !== id) : [...cur.ids, id],
              }
            : cur,
        ),
      clear: clearSelection,
    }
    return <SelectionProvider value={value}>{content}</SelectionProvider>
  }
  const selectButton = (page: string) => (
    <SelectButton
      active={selecting?.page === page}
      onClick={() => setSelecting(selecting?.page === page ? null : { page, ids: [] })}
    />
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
  const folderGrid = (list: Folder[], add?: AddAction, compact?: boolean) => (
    <FolderGrid
      compact={compact}
      folders={list}
      library={library}
      sortable={folderSort === 'custom'}
      reload={reload}
      layout={layout}
      add={add}
    />
  )
  const notebookGrid = (list: Notebook[], add?: AddAction, compact?: boolean) => (
    <NotebookGrid
      compact={compact}
      notebooks={list}
      library={library}
      reload={reload}
      layout={layout}
      showFolder
      add={add}
    />
  )

  /** A page of the carousel, and a page for each of its groups shown on their own. */
  const tabPages = <T extends { id: string }>(
    key: HomeTabKey,
    title: string,
    actions: React.ReactNode,
    items: T[],
    grid: (list: T[], add?: AddAction, compact?: boolean) => React.ReactNode,
    add: AddAction,
    empty: string,
  ): CarouselPage[] => {
    const tab = tabs[key]
    const onChange = (next: HomeTab) => change(key, next)
    const kind = key === 'folders' ? 'folder' : 'notebook'
    const label = (item: T) =>
      'name' in item ? String(item.name) : 'title' in item ? String(item.title) : ''
    const organizer = makeOrganizer(tab, onChange)
    const { pinned, groups, rest } = arrange(tab, items)
    /** A group's items, its own pinned ones apart; pins there belong to the group. */
    const groupContent = (group: HomeGroup, own: T[], list: T[]) => (
      <OrganizerProvider value={makeOrganizer(tab, onChange, group.id)}>
        <div className="grid gap-3">
          {own.length ? (
            <PinnedSection count={own.length}>{grid(own, undefined, true)}</PinnedSection>
          ) : null}
          {list.length ? grid(list) : null}
        </div>
      </OrganizerProvider>
    )
    pageItems.set(key, {
      kind,
      tab: key,
      items: items.map((item) => ({ id: item.id, label: label(item) })),
    })
    const main: CarouselPage = {
      key,
      title,
      actions: (
        <>
          {selectButton(key)}
          <NewGroupButton tab={tab} onChange={onChange} />
          {actions}
        </>
      ),
      content: selectable(
        key,
        <OrganizerProvider value={organizer}>
          <div className="grid gap-4">
            {pinned.length ? (
              <PinnedSection count={pinned.length}>{grid(pinned, undefined, true)}</PinnedSection>
            ) : null}
            {groups.map(({ group, pinned: own, items: list }) => (
              <GroupSection
                key={group.id}
                group={group}
                count={own.length + list.length}
                tab={tab}
                onChange={onChange}
              >
                {groupContent(group, own, list)}
              </GroupSection>
            ))}
            {items.length === 0 ? <p className="text-sm text-ink-muted">{empty}</p> : null}
            {grid(rest, selecting?.page === key ? undefined : add)}
          </div>
        </OrganizerProvider>,
      ),
    }
    const own = groups
      .filter(({ group }) => group.ownTab)
      .map(({ group, pinned: ownPins, items: list }): CarouselPage => {
        const page = `group:${group.id}`
        pageItems.set(page, {
          kind,
          tab: key,
          items: [...ownPins, ...list].map((item) => ({ id: item.id, label: label(item) })),
        })
        return {
          key: page,
          title: group.name,
          group: true,
          actions: selectButton(page),
          content:
            ownPins.length + list.length ? (
              selectable(page, groupContent(group, ownPins, list))
            ) : (
              <p className="text-sm text-ink-muted">
                Nothing in “{group.name}” yet. On the {title} page, hold something and drop it onto
                this group.
              </p>
            ),
        }
      })
    return [main, ...own]
  }

  const pages: CarouselPage[] = [
    {
      key: 'create',
      title: 'Create',
      content: <CreateOptions layout={layout} onPick={setCreating} />,
    },
    ...tabPages(
      'folders',
      'Folders',
      <SortMenu
        label="Sort folders"
        value={folderSort}
        options={FOLDER_SORTS}
        onChange={setFolderSort}
      />,
      topFolders,
      folderGrid,
      { label: 'New folder', onAdd: () => setCreating('folder') },
      'No folders yet. Make one for each subject.',
    ),
    ...tabPages(
      'notebooks',
      'Notebooks',
      sortMenu('Sort notebooks'),
      ofKind('notebook'),
      notebookGrid,
      { label: 'New notebook', onAdd: () => setCreating('notebook') },
      'No notebooks yet.',
    ),
    ...tabPages(
      'presentations',
      'Presentations',
      sortMenu('Sort presentations'),
      ofKind('presentation'),
      notebookGrid,
      { label: 'New presentation', onAdd: () => setCreating('presentation') },
      'No presentations yet.',
    ),
    ...tabPages(
      'flashcards',
      'Flashcards',
      sortMenu('Sort flashcards'),
      ofKind('deck'),
      notebookGrid,
      { label: 'New flashcards', onAdd: () => setCreating('deck') },
      'No flashcards yet. Make a deck, write on its cards with your pencil, then study it.',
    ),
    ...tabPages(
      'quizzes',
      'Quizzes',
      sortMenu('Sort quizzes'),
      ofKind('quiz'),
      notebookGrid,
      { label: 'New quiz', onAdd: () => setCreating('quiz') },
      'No quizzes yet. Make one with true or false, multiple choice, puzzles and more, then play it.',
    ),
  ]
  const index = Math.max(
    0,
    pages.findIndex((p) => p.key === (shown ?? page)),
  )
  const chosen = selecting ? pageItems.get(selecting.page) : undefined
  const bar =
    selecting && chosen ? (
      <SelectionBar
        kind={chosen.kind}
        ids={selecting.ids}
        total={chosen.items.length}
        folders={library.folders}
        tab={tabs[chosen.tab]}
        onCancel={clearSelection}
        onSelectAll={() =>
          setSelecting({ page: selecting.page, ids: chosen.items.map((i) => i.id) })
        }
        onMove={(folderId) => {
          const items = chosen.items.filter((i) => selecting.ids.includes(i.id))
          void moveMany(chosen.kind, items, folderId, library, () => {
            clearSelection()
            reload()
          })
        }}
        onGroup={(groupId) => {
          const tab = tabs[chosen.tab]
          makeOrganizer(tab, (next) => change(chosen.tab, next)).moveManyToGroup(
            selecting.ids,
            groupId,
            `${selecting.ids.length} ${selecting.ids.length === 1 ? 'item' : 'items'}`,
          )
          clearSelection()
        }}
        onDelete={() => {
          const items = chosen.items.filter((i) => selecting.ids.includes(i.id))
          const first = items[0]
          if (!first) return
          makeDrop(
            library,
            reload,
            null,
            clearSelection,
          )({
            kind: chosen.kind,
            id: first.id,
            label: first.label,
            many: items,
          })({ kind: 'trash' })
        }}
      />
    ) : null
  return (
    <>
      <Carousel
        pages={pages}
        index={index}
        onIndex={(i) => {
          const key = pages[i]?.key ?? 'create'
          setShown(key)
          if (selecting && selecting.page !== key) setSelecting(null)
          // Only the main pages are remembered for the next visit.
          const main = PAGES.find((p) => p === key)
          if (main) setPage(main)
        }}
        // A held notebook, presentation or deck can be dropped into any folder from here.
        overlay={
          <>
            <FolderDropStrip folders={library.folders} notebooks={library.notebooks} />
            {bar}
          </>
        }
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
    <NotebookPen key="n" size={22} />,
  ],
  [
    'folder',
    'Folder',
    'Keep notebooks, presentations and flashcards together, e.g. one per subject.',
    <FolderPlus key="f" size={22} />,
  ],
  [
    'presentation',
    'Presentation',
    'Slides made with the same pens and tools, presented full screen.',
    <Presentation key="p" size={22} />,
  ],
  [
    'deck',
    'Flashcards',
    'Cards with a front and a back; what you don’t know comes again soon.',
    <Layers key="d" size={22} />,
  ],
  [
    'quiz',
    'Quiz',
    'Questions against the clock: multiple choice, true or false, puzzles and more.',
    <Gamepad2 key="q" size={22} />,
  ],
]

/** The Create page, as a compact list or as tiles, with the shop last. Room for six. */
function CreateOptions({
  layout,
  onPick,
}: {
  layout: LibraryLayout
  onPick: (kind: NonNullable<Creating>) => void
}) {
  const tiles = layout === 'tiles'
  const shop = (
    <li key="shop" className="min-w-0">
      <button
        type="button"
        onClick={() => navigate({ name: 'shop' })}
        className={cn(
          'flex w-full rounded-card bg-surface text-left ring-1 ring-line transition-transform duration-150 ease-gentle hover:bg-surface-sunken active:scale-[0.99]',
          tiles ? 'h-full flex-col justify-center gap-2 p-4' : 'items-center gap-3 p-3',
        )}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-accent text-ink-inverse shadow-soft">
          <Store size={22} />
        </span>
        <span className={cn('min-w-0', !tiles && 'flex-1')}>
          <span className="block text-base font-bold">Shop</span>
          <span className={cn('block text-sm text-ink-muted', tiles ? 'line-clamp-3' : 'truncate')}>
            Design packs, planners and templates, free and paid.
          </span>
        </span>
        {tiles ? null : <ChevronRight size={20} className="shrink-0 text-ink-muted" />}
      </button>
    </li>
  )
  return (
    <ul
      className={cn(
        tiles ? 'grid h-full min-h-[20rem] grid-cols-3 grid-rows-2 gap-3' : 'grid gap-2',
      )}
    >
      {CREATE_OPTIONS.map(([kind, title, text, icon]) => (
        <li key={kind} className="min-w-0">
          <button
            type="button"
            onClick={() => onPick(kind)}
            className={cn(
              'flex w-full rounded-card bg-surface text-left ring-1 ring-line transition-transform duration-150 ease-gentle hover:bg-surface-sunken active:scale-[0.99]',
              tiles ? 'h-full flex-col justify-center gap-2 p-4' : 'items-center gap-3 p-3',
            )}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-ink text-ink-inverse shadow-soft">
              {icon}
            </span>
            <span className={cn('min-w-0', !tiles && 'flex-1')}>
              <span className="block text-base font-bold">{title}</span>
              <span
                className={cn('block text-sm text-ink-muted', tiles ? 'line-clamp-3' : 'truncate')}
              >
                {text}
              </span>
            </span>
            {tiles ? null : <ChevronRight size={20} className="shrink-0 text-ink-muted" />}
          </button>
        </li>
      ))}
      {shop}
    </ul>
  )
}

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
      ) : creating === 'quiz' ? (
        <NewQuizDialog
          folders={library.folders}
          folderId={null}
          onFoldersChanged={reload}
          onCreated={(id) => navigate({ name: 'quiz', id })}
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
  const found = sortNotebooks(
    library.notebooks.filter((n) => n.title.toLocaleLowerCase().includes(q)),
    'recent',
  )
  // Each kind under its own heading.
  const kinds = (
    [
      ['notebook', 'Notebooks'],
      ['presentation', 'Presentations'],
      ['deck', 'Flashcards'],
      ['quiz', 'Quizzes'],
    ] as const
  )
    .map(([kind, title]) => ({
      title,
      list: found.filter((n) => (n.kind ?? 'notebook') === kind),
    }))
    .filter(({ list }) => list.length > 0)
  if (!folders.length && !found.length) {
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
      {kinds.map(({ title, list }) => (
        <Section key={title} title={`${title} (${list.length})`}>
          <NotebookGrid
            notebooks={list}
            library={library}
            reload={reload}
            layout={layout}
            showFolder
          />
        </Section>
      ))}
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

export function NewQuizButton({
  library,
  reload,
  folderId = null,
}: {
  library: Library | null
  reload: () => void
  folderId?: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button icon={<Gamepad2 size={18} />}>New quiz</Button>
      </DialogTrigger>
      {open ? (
        <NewQuizDialog
          folders={library?.folders ?? []}
          folderId={folderId}
          onFoldersChanged={reload}
          onCreated={(id) => navigate({ name: 'quiz', id })}
        />
      ) : null}
    </Dialog>
  )
}
