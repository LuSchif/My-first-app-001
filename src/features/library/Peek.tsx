import {
  ChevronLeft,
  FolderOpen,
  GraduationCap,
  Layers,
  Pencil,
  Plus,
  Presentation,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { fillToCss, prefersLightText } from '../../engine/model/fill.ts'
import type { Folder, Notebook, Page, PaperKind } from '../../engine/model/types.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { Button, IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { formatEdited } from '../../lib/time.ts'
import { createPage } from '../../engine/model/factory.ts'
import {
  appendPage,
  deletePages,
  loadNotebook,
  saveStudy,
  setNotebookPaper,
} from '../../storage/notebooks.ts'
import { PAPER_OPTIONS, paperPreviewStyle } from '../paper.ts'
import { PageThumbnail } from '../editor/PageThumbnail.tsx'
import { openNotebookAt } from '../editor/openAt.ts'
import { FolderGraphic } from '../folders/FolderGraphic.tsx'
import { countNotebooks, notebooksIn } from './libraryActions.ts'
import { NotebookThumbnail } from './NotebookThumbnail.tsx'
import { openPeek, usePeek } from './peek.ts'
import { cardsOf, dueCount, type Card } from '../../engine/model/flashcards.ts'
import { useNow } from '../calendar/useNow.ts'
import { Study } from '../flashcards/Study.tsx'
import { useDraggable, useDragState, type DropTarget } from './dragDrop.ts'
import { moveToTrash, useTrashed } from './trash.ts'
import { showNotice } from '../../lib/notices.ts'
import type { Library } from './useLibrary.ts'

/** Pages shown at most; the rest are a tap on "Open" away. */
const MAX_PAGES = 60
/** When the pages start coming out, after the cover has opened, and between two pages. */
const PAGES_START_MS = 380
const PAGE_STAGGER_MS = 45

/** Becomes true right after the first paint, so CSS transitions play from the closed state. */
function useOpened(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 40)
    return () => clearTimeout(timer)
  }, [])
  return open
}

const stagger = (i: number) => ({ animationDelay: `${PAGES_START_MS + i * PAGE_STAGGER_MS}ms` })

/**
 * A look into a notebook, presentation or folder over the library: the notebook opens like a
 * book and its pages come out to the right; a folder opens and shows what is in it. A tap on a
 * page opens the notebook there.
 */
export function PeekLayer({ library, reload }: { library: Library; reload: () => void }) {
  const target = usePeek()
  const close = () => openPeek(null)

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openPeek(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target])

  if (!target) return null
  const notebook =
    target.kind === 'notebook' ? library.notebooks.find((n) => n.id === target.id) : undefined
  const folder =
    target.kind === 'folder' ? library.folders.find((f) => f.id === target.id) : undefined
  if (!notebook && !folder) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-scrim backdrop-blur-[2px]"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={notebook?.title ?? folder?.name}
        className="relative flex h-[min(42rem,100%)] w-[min(64rem,100%)] animate-pop-in flex-col overflow-hidden rounded-panel bg-surface-raised shadow-overlay md:flex-row"
      >
        <IconButton
          label="Close"
          icon={<X size={20} />}
          onClick={close}
          className="absolute top-3 right-3 z-10"
        />
        {notebook?.kind === 'deck' ? (
          <DeckPeek key={notebook.id} deck={notebook} library={library} reload={reload} />
        ) : notebook ? (
          <NotebookPeek key={notebook.id} notebook={notebook} library={library} reload={reload} />
        ) : folder ? (
          <FolderPeek key={folder.id} folder={folder} library={library} />
        ) : null}
      </div>
    </div>
  )
}

function NotebookPeek({
  notebook,
  library,
  reload,
}: {
  notebook: Notebook
  library: Library
  reload: () => void
}) {
  const [pages, setPages] = usePages(notebook.id)
  const trashed = useTrashed()
  const shownPages = pages?.filter((p) => !trashed.has(p.id)) ?? null
  const slides = notebook.kind === 'presentation'
  const parent = library.folders.find((f) => f.id === notebook.folderId)

  const count = shownPages?.length ?? notebook.pageIds.length
  const unit = slides ? 'slide' : 'page'
  return (
    <>
      <Side>
        <BackToFolder folder={parent} />
        <div className="grid flex-1 place-items-center py-4">
          {slides ? (
            <OpeningSlides notebook={notebook} />
          ) : (
            <OpeningBook notebook={notebook} first={pages?.[0]} />
          )}
        </div>
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-lg font-bold">
            <span className="truncate">{notebook.title}</span>
            {slides ? <Presentation size={16} className="shrink-0 text-ink-muted" /> : null}
          </p>
          <p className="text-sm text-ink-muted">
            Edited {formatEdited(notebook.updatedAt)} · {count} {unit}
            {count === 1 ? '' : 's'}
          </p>
        </div>
        {slides ? null : (
          <PaperChoice
            value={pages?.[0]?.paper ?? notebook.paper}
            onChange={(paper) => {
              setNotebookPaper(notebook.id, paper)
                .then(() => {
                  setPages((list) => list?.map((p) => ({ ...p, paper })) ?? null)
                  reload()
                })
                .catch((err: unknown) => {
                  console.error(err)
                  showNotice('The paper could not be changed.')
                })
            }}
          />
        )}
        <Button
          variant="primary"
          onClick={() => {
            openPeek(null)
            navigate({ name: 'notebook', id: notebook.id })
          }}
        >
          Open {slides ? 'presentation' : 'notebook'}
        </Button>
      </Side>
      <Contents title={slides ? 'Slides' : 'Pages'}>
        {pages === null || shownPages === null ? null : (
          <ol
            className={cn(
              'grid gap-4',
              slides
                ? 'grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]'
                : 'grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]',
            )}
          >
            {shownPages.slice(0, MAX_PAGES).map((page, i) => (
              <PeekPage
                key={page.id}
                notebook={notebook}
                page={page}
                number={i + 1}
                index={pages.indexOf(page)}
                width={slides ? 220 : 150}
                onDrop={(target) => {
                  if (target.kind !== 'trash') return
                  if (shownPages.length <= 1) {
                    showNotice(
                      `A ${slides ? 'presentation' : 'notebook'} keeps at least one ${unit}.`,
                    )
                    return
                  }
                  moveToTrash(
                    [page.id],
                    `Deleted ${unit} ${i + 1} of “${notebook.title}”.`,
                    { pageIds: [page.id] },
                    () => deletePages(notebook.id, [page.id]),
                    // The page stays in the list, hidden while it is trashed: Undo shows it again.
                    reload,
                  )
                }}
              />
            ))}
            {shownPages.length < MAX_PAGES ? (
              <AddPage
                notebook={notebook}
                unit={unit}
                number={shownPages.length + 1}
                onAdded={(page) => {
                  setPages((list) => (list ? [...list, page] : list))
                  reload()
                }}
              />
            ) : null}
          </ol>
        )}
        {shownPages && shownPages.length > MAX_PAGES ? (
          <p className="mt-4 text-sm text-ink-muted">
            And {shownPages.length - MAX_PAGES} more {unit}s.
          </p>
        ) : null}
      </Contents>
    </>
  )
}

/** The paper of every page of a notebook, chosen from small previews. */
function PaperChoice({
  value,
  onChange,
}: {
  value: PaperKind
  onChange: (paper: PaperKind) => void
}) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">Paper</p>
      <div role="group" aria-label="Paper" className="grid grid-cols-5 gap-2">
        {PAPER_OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            aria-pressed={value === option.kind}
            data-choice
            onClick={() => value !== option.kind && onChange(option.kind)}
            className="group grid gap-1 rounded-lg p-0.5 text-xs"
          >
            <span
              className="aspect-[3/4] w-full rounded-md shadow-soft ring-1 ring-line group-aria-pressed:ring-2 group-aria-pressed:ring-ink"
              style={paperPreviewStyle(option.kind)}
            />
            <span className="truncate text-ink-muted group-aria-pressed:font-semibold group-aria-pressed:text-ink">
              {option.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** A notebook's pages, loaded for its peek; null while loading. */
function usePages(
  notebookId: string,
): [Page[] | null, React.Dispatch<React.SetStateAction<Page[] | null>>] {
  const [pages, setPages] = useState<Page[] | null>(null)
  useEffect(() => {
    let alive = true
    loadNotebook(notebookId)
      .then((data) => {
        if (!alive) return
        // In the notebook's order, so a page's place here is its place in the notebook.
        const order = new Map(data?.notebook.pageIds.map((id, i) => [id, i]))
        const sorted = (data?.pages ?? []).filter((p) => order.has(p.id))
        sorted.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
        setPages(sorted)
      })
      .catch((err: unknown) => {
        console.error(err)
        if (alive) setPages([])
      })
    return () => {
      alive = false
    }
  }, [notebookId])
  return [pages, setPages]
}

/** Back to the folder this is in, as a peek. */
function BackToFolder({ folder }: { folder: Folder | undefined }) {
  if (!folder) return null
  return (
    <button
      type="button"
      onClick={() => openPeek({ kind: 'folder', id: folder.id })}
      className="flex items-center gap-1 self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
    >
      <ChevronLeft size={16} /> {folder.name}
    </button>
  )
}

/** A deck of flashcards: its cards fan out, each with front and back; study or edit them. */
function DeckPeek({
  deck,
  library,
  reload,
}: {
  deck: Notebook
  library: Library
  reload: () => void
}) {
  const [pages] = usePages(deck.id)
  const [studying, setStudying] = useState<number | null>(null)
  const trashed = useTrashed()
  const now = useNow()
  const cards = cardsOf(deck.pageIds).filter((c) => !trashed.has(c.front))
  const byId = new Map((pages ?? []).map((p) => [p.id, p]))
  const due = dueCount(deck, now.getTime())
  const parent = library.folders.find((f) => f.id === deck.folderId)
  return (
    <>
      <Side>
        <BackToFolder folder={parent} />
        <div className="grid flex-1 place-items-center py-4">
          <OpeningCards deck={deck} />
        </div>
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-lg font-bold">
            <span className="truncate">{deck.title}</span>
            <Layers size={16} className="shrink-0 text-ink-muted" />
          </p>
          <p className="text-sm text-ink-muted">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'} ·{' '}
            {due ? `${due} due now` : 'all learned for now'}
          </p>
        </div>
        <div className="grid gap-2">
          <Button
            variant="primary"
            icon={<GraduationCap size={18} />}
            disabled={pages === null}
            onClick={() => setStudying(Date.now())}
          >
            Study{due ? ` · ${due} due` : ''}
          </Button>
          <Button
            icon={<Pencil size={18} />}
            onClick={() => {
              openPeek(null)
              navigate({ name: 'notebook', id: deck.id })
            }}
          >
            Edit cards
          </Button>
        </div>
      </Side>
      <Contents title="Cards">
        {pages === null ? null : (
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
            {cards.map((card, i) => (
              <PeekCard
                key={card.front}
                deck={deck}
                card={card}
                number={i + 1}
                front={byId.get(card.front)}
                back={card.back === card.front ? undefined : byId.get(card.back)}
                onDrop={(target) => {
                  if (target.kind !== 'trash') return
                  if (cards.length <= 1) {
                    showNotice('A deck keeps at least one card.')
                    return
                  }
                  const sides = [card.front, card.back]
                  moveToTrash(
                    sides,
                    `Deleted card ${i + 1} of “${deck.title}”.`,
                    { pageIds: sides },
                    () => deletePages(deck.id, sides, 2),
                    reload,
                  )
                }}
              />
            ))}
          </ol>
        )}
      </Contents>
      {studying !== null && pages
        ? createPortal(
            <Study
              deck={deck}
              pages={pages}
              startedAt={studying}
              onSave={(study) => void saveStudy(deck.id, study).catch(console.error)}
              onExit={() => {
                setStudying(null)
                reload()
              }}
            />,
            document.body,
          )
        : null}
    </>
  )
}

/** One flashcard in a deck's peek, front and back side by side; a tap edits it. */
function PeekCard({
  deck,
  card,
  number,
  front,
  back,
  onDrop,
}: {
  deck: Notebook
  card: Card
  number: number
  front: Page | undefined
  back: Page | undefined
  onDrop: (target: DropTarget) => void
}) {
  const drag = useDragState()
  const dragging = drag?.item.kind === 'page' && drag.item.id === card.front
  const draggable = useDraggable(
    { kind: 'page', id: card.front, label: `Card ${number}`, notebookId: deck.id },
    onDrop,
  )
  const face = (page: Page | undefined, side: string) => (
    <span className="relative block overflow-hidden rounded-md shadow-soft ring-1 ring-line">
      {page ? (
        <PageThumbnail
          width={150}
          page={page}
          layers={deck.layers}
          background={deck.background}
          size={pageSizeOf(deck)}
        />
      ) : null}
      <span className="absolute top-1 left-1 rounded-full bg-surface-raised/90 px-1.5 text-[10px] font-semibold text-ink-muted uppercase">
        {side}
      </span>
    </span>
  )
  return (
    <li
      className={cn('animate-page-out transition-opacity', dragging && 'opacity-40')}
      style={stagger(number - 1)}
    >
      <button
        type="button"
        {...draggable}
        onClick={() => {
          openPeek(null)
          openNotebookAt(deck.id, card.index * 2)
        }}
        className="grid w-full touch-manipulation gap-1.5 text-left select-none [-webkit-touch-callout:none]"
      >
        <span className="grid grid-cols-2 gap-1.5 transition-transform duration-150 ease-gentle hover:-translate-y-0.5">
          {face(front, 'Front')}
          {back ? face(back, 'Back') : null}
        </span>
        <span className="text-center text-xs font-semibold text-ink-muted tabular-nums">
          {number}
        </span>
      </button>
    </li>
  )
}

/** A deck: its cards fan out from the stack. */
function OpeningCards({ deck }: { deck: Notebook }) {
  const open = useOpened()
  const behind = Math.min(3, Math.ceil(deck.pageIds.length / 2) - 1)
  return (
    <div className="relative w-56">
      {Array.from({ length: behind }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-md bg-paper shadow-soft ring-1 ring-line transition-transform duration-700 ease-gentle"
          style={{
            background: deck.background,
            transform: open
              ? `rotate(${(i + 1) * 7}deg) translate(${(i + 1) * 10}px, ${-(i + 1) * 4}px)`
              : 'none',
            transformOrigin: 'bottom left',
          }}
        />
      ))}
      <div
        className="relative overflow-hidden rounded-md shadow-raised ring-1 ring-line transition-transform duration-700 ease-gentle"
        style={{ transform: open ? 'rotate(-4deg)' : 'none', transformOrigin: 'bottom left' }}
      >
        <NotebookThumbnail
          notebook={deck}
          width={224}
          className="!w-full rounded-none shadow-none"
        />
      </div>
    </div>
  )
}

/** One page in a notebook's peek: a tap opens the notebook there; hold it to drag it. */
function PeekPage({
  notebook,
  page,
  number,
  index,
  width,
  onDrop,
}: {
  notebook: Notebook
  page: Page
  number: number
  /** Where the page is in the notebook. */
  index: number
  width: number
  onDrop: (target: DropTarget) => void
}) {
  const drag = useDragState()
  const dragging = drag?.item.kind === 'page' && drag.item.id === page.id
  const draggable = useDraggable(
    { kind: 'page', id: page.id, label: `Page ${number}`, notebookId: notebook.id },
    onDrop,
  )
  return (
    <li
      className={cn('animate-page-out transition-opacity', dragging && 'opacity-40')}
      style={stagger(number - 1)}
    >
      <button
        type="button"
        {...draggable}
        onClick={() => {
          openPeek(null)
          openNotebookAt(notebook.id, index)
        }}
        className="grid w-full touch-manipulation gap-1.5 text-left select-none [-webkit-touch-callout:none]"
      >
        <span className="block overflow-hidden rounded-md shadow-soft ring-1 ring-line transition-transform duration-150 ease-gentle hover:-translate-y-0.5">
          <PageThumbnail
            width={width}
            page={page}
            layers={notebook.layers}
            background={notebook.background}
            size={pageSizeOf(notebook)}
          />
        </span>
        <span className="text-center text-xs font-semibold text-ink-muted tabular-nums">
          {number}
        </span>
      </button>
    </li>
  )
}

/** The last tile of a notebook's pages: adds an empty page at the end. */
function AddPage({
  notebook,
  unit,
  number,
  onAdded,
}: {
  notebook: Notebook
  unit: string
  number: number
  onAdded: (page: Page) => void
}) {
  const [busy, setBusy] = useState(false)
  const size = pageSizeOf(notebook)
  return (
    <li className="animate-page-out" style={stagger(number - 1)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          const page = createPage(notebook.id, notebook.paper)
          appendPage(notebook.id, page)
            .then(() => onAdded(page))
            .catch((err: unknown) => {
              console.error(err)
              showNotice(`The ${unit} could not be added.`)
            })
            .finally(() => setBusy(false))
        }}
        className="grid w-full touch-manipulation gap-1.5 text-left select-none"
      >
        <span
          className="grid place-items-center rounded-md border-2 border-dashed border-line-strong text-ink-muted transition-colors duration-150 hover:bg-hover hover:text-ink"
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        >
          <span className="grid justify-items-center gap-1 text-xs font-semibold">
            <Plus size={22} />
            Add {unit}
          </span>
        </span>
        {/* Room for a number, like the pages beside it. */}
        <span aria-hidden="true" className="h-4" />
      </button>
    </li>
  )
}

/** A notebook whose cover swings open to the left, showing its first page on the right. */
function OpeningBook({ notebook, first }: { notebook: Notebook; first: Page | undefined }) {
  const open = useOpened()
  const light = prefersLightText(notebook.cover)
  return (
    // The cover opens to the left, so the book sits in the right half of this space.
    <div className="flex w-[18rem] justify-end [perspective:1400px]">
      <div className="relative aspect-[3/4] w-36">
        <div className="absolute inset-0 overflow-hidden rounded-r-md bg-paper shadow-raised">
          {first ? (
            <PageThumbnail
              width={144}
              page={first}
              layers={notebook.layers}
              background={notebook.background}
              size={pageSizeOf(notebook)}
            />
          ) : null}
        </div>
        <div
          className="absolute inset-0 origin-left transition-transform duration-700 ease-gentle [transform-style:preserve-3d]"
          style={{ transform: open ? 'rotateY(-165deg)' : 'rotateY(0deg)' }}
        >
          {/* Outside of the cover. */}
          <div
            className={cn(
              'absolute inset-0 flex items-end rounded-l-md rounded-r-card p-3 shadow-raised [backface-visibility:hidden]',
              light ? 'text-ink-inverse' : 'text-ink',
            )}
            style={{ background: fillToCss(notebook.cover) }}
          >
            <span className="line-clamp-3 font-bold leading-tight [overflow-wrap:anywhere]">
              {notebook.title}
            </span>
          </div>
          {/* Inside of the cover. */}
          <div
            className="absolute inset-0 rounded-l-card rounded-r-md bg-surface-sunken shadow-soft [backface-visibility:hidden]"
            style={{ transform: 'rotateY(180deg)' }}
          />
        </div>
      </div>
    </div>
  )
}

/** A presentation: its first slide with the next ones fanning out behind it. */
function OpeningSlides({ notebook }: { notebook: Notebook }) {
  const open = useOpened()
  const behind = Math.min(2, notebook.pageIds.length - 1)
  return (
    <div className="relative w-56">
      {Array.from({ length: behind }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-md bg-paper shadow-soft ring-1 ring-line transition-transform duration-700 ease-gentle"
          style={{
            transform: open
              ? `translate(${(i + 1) * 14}px, ${-(i + 1) * 10}px) rotate(${(i + 1) * 3}deg)`
              : 'none',
          }}
        />
      ))}
      <div className="relative overflow-hidden rounded-md shadow-raised ring-1 ring-line">
        <NotebookThumbnail
          notebook={notebook}
          width={224}
          className="!w-full rounded-none shadow-none"
        />
      </div>
    </div>
  )
}

function FolderPeek({ folder, library }: { folder: Folder; library: Library }) {
  const open = useOpened()
  const subfolders = library.folders
    .filter((f) => f.parentId === folder.id)
    .sort((a, b) => a.order - b.order)
  const notebooks = notebooksIn(library.notebooks, folder.id)
  const parent = library.folders.find((f) => f.id === folder.parentId)
  const count = countNotebooks(library.folders, library.notebooks, folder.id)
  return (
    <>
      <Side>
        {parent ? (
          <button
            type="button"
            onClick={() => openPeek({ kind: 'folder', id: parent.id })}
            className="flex items-center gap-1 self-start rounded-control py-1 pr-2 text-sm font-semibold text-ink-muted hover:bg-hover"
          >
            <ChevronLeft size={16} /> {parent.name}
          </button>
        ) : null}
        <div className="grid flex-1 place-items-center py-4">
          <FolderGraphic fill={folder.fill} icon={folder.icon} open={open} className="w-44" />
        </div>
        <div className="grid gap-1">
          <p className="truncate text-lg font-bold">{folder.name}</p>
          <p className="text-sm text-ink-muted">
            {count} {count === 1 ? 'notebook' : 'notebooks'}
            {subfolders.length
              ? ` · ${subfolders.length} ${subfolders.length === 1 ? 'folder' : 'folders'}`
              : ''}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<FolderOpen size={18} />}
          onClick={() => {
            openPeek(null)
            navigate({ name: 'folder', id: folder.id })
          }}
        >
          Open folder
        </Button>
      </Side>
      <Contents title="In this folder">
        {subfolders.length === 0 && notebooks.length === 0 ? (
          <p className="text-sm text-ink-muted">This folder is empty.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-4 gap-y-5">
            {subfolders.map((f, i) => (
              <li key={f.id} className="animate-page-out" style={stagger(i)}>
                <button
                  type="button"
                  onClick={() => openPeek({ kind: 'folder', id: f.id })}
                  className="grid w-full justify-items-center gap-1.5"
                >
                  <FolderGraphic fill={f.fill} icon={f.icon} className="w-full" />
                  <span className="w-full truncate text-center text-sm font-semibold">
                    {f.name}
                  </span>
                </button>
              </li>
            ))}
            {notebooks.map((n, i) => (
              <li key={n.id} className="animate-page-out" style={stagger(subfolders.length + i)}>
                <button
                  type="button"
                  onClick={() => openPeek({ kind: 'notebook', id: n.id })}
                  className="grid w-full justify-items-center gap-1.5"
                >
                  <span className="grid aspect-[6/5] w-full place-items-center">
                    {n.kind === 'presentation' || n.kind === 'deck' ? (
                      <NotebookThumbnail notebook={n} width={120} className="!w-full shadow-soft" />
                    ) : (
                      <span
                        className="block aspect-[3/4] h-full rounded-l-sm rounded-r-md shadow-raised"
                        style={{ background: fillToCss(n.cover) }}
                      />
                    )}
                  </span>
                  <span className="w-full truncate text-center text-sm font-semibold">
                    {n.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Contents>
    </>
  )
}

/** The left part: the item itself, its name and the button to open it. */
function Side({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-4 border-line bg-surface p-5 max-md:border-b md:w-[22rem] md:border-r">
      {children}
    </div>
  )
}

/** The right part: what is inside, scrolling on its own. */
function Contents({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h2 className="px-5 pt-5 pb-3 text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
    </div>
  )
}
