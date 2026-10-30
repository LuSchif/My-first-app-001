import {
  FolderClosed,
  Gamepad2,
  FolderInput,
  Layers,
  BarChart3,
  Check,
  MoreHorizontal,
  Pin,
  Presentation,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { fillToCss, prefersLightText } from '../../engine/model/fill.ts'
import { dueCount } from '../../engine/model/flashcards.ts'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { formatEdited } from '../../lib/time.ts'
import { moveNotebook } from '../../storage/folders.ts'
import { deleteNotebook } from '../../storage/notebooks.ts'
import { useNow } from '../calendar/useNow.ts'
import { useDraggable, useDragState, type DropTarget } from './dragDrop.ts'
import { MoveList } from './MoveList.tsx'
import { NotebookThumbnail } from './NotebookThumbnail.tsx'
import { openPeek } from './peek.ts'
import { kindName } from './kinds.ts'
import { QuizCover } from '../quiz/QuizCover.tsx'
import { useOrganizer } from './organizer.ts'
import { GroupList, OrganizeItems } from './OrganizeMenu.tsx'

/**
 * The name and details under a tile. Always this tall (room for a folder chip), so every tile on
 * the home screen, of every kind, has the same size.
 */
export const TILE_TEXT = 'min-h-[4.5rem]'

/** Marks a pinned tile, in its top right corner (`inset`: inside a notebook's cover). */
export function PinMark({ inset = false }: { inset?: boolean }) {
  return (
    <span
      aria-label="Pinned"
      className={cn(
        'absolute grid size-7 place-items-center rounded-full bg-accent text-ink-inverse shadow-soft',
        inset ? 'top-2 right-2' : 'top-0 right-0',
      )}
    >
      <Pin size={14} className="fill-current" />
    </span>
  )
}

/** The round check of a selectable item: filled when it is selected. */
export function SelectMark({
  selected,
  inline = false,
  inset = false,
}: {
  selected: boolean
  /** In a row, before the item. */
  inline?: boolean
  /** Inside a notebook's cover. */
  inset?: boolean
}) {
  return (
    <span
      role="checkbox"
      aria-checked={selected}
      aria-label={selected ? 'Selected' : 'Not selected'}
      className={cn(
        'pointer-events-none grid size-7 shrink-0 place-items-center rounded-full ring-2 transition-colors',
        inline
          ? ''
          : inset
            ? 'absolute top-2 left-2 shadow-soft'
            : 'absolute top-0 left-0 shadow-soft',
        selected
          ? 'bg-accent text-ink-inverse ring-surface-raised'
          : 'bg-surface-raised/90 text-transparent ring-line-strong',
      )}
    >
      <Check size={16} strokeWidth={3} />
    </span>
  )
}

const tilePress =
  'touch-manipulation select-none [-webkit-touch-callout:none] transition-transform duration-200 ease-gentle hover:-translate-y-0.5 active:scale-[0.98]'

/**
 * A notebook, presentation or deck of flashcards in the library: a tap looks inside; hold (or
 * drag with a mouse) to drop it on a folder or the trash; the menu moves or deletes it. With
 * `showFolder`, the folder it is in shows under its name.
 */
export function NotebookCard({
  notebook,
  folders,
  onOpen,
  onChanged,
  onDrop,
  showFolder = false,
  selected,
  many,
}: {
  notebook: Notebook
  folders: readonly Folder[]
  onOpen: () => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
  showFolder?: boolean
  /** Whether it is selected; undefined when not selecting. */
  selected?: boolean
  /** Every selected item, carried along when this one is dragged. */
  many?: { id: string; label: string }[]
}) {
  const light = prefersLightText(notebook.cover)
  const drag = useDragState()
  const dragging = drag?.item.kind === 'notebook' && drag.item.id === notebook.id
  const draggable = useDraggable(
    { kind: 'notebook', id: notebook.id, label: notebook.title, many },
    onDrop,
  )
  const open = { type: 'button' as const, onClick: onOpen, 'aria-label': `Open ${notebook.title}` }
  const pinned = useOrganizer()?.isPinned(notebook.id) ?? false
  return (
    // min-w-0: a long title must not widen its column; every card has the column's width.
    <li
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2.5 transition-opacity',
        dragging && 'opacity-40',
      )}
    >
      {/* Every kind is as big as a folder tile, with nothing drawn around it. */}
      <div className="relative grid aspect-[6/5] w-full place-items-center p-1">
        {notebook.kind === 'presentation' ? (
          <button
            {...open}
            {...draggable}
            className={cn('relative grid w-full min-w-0 place-items-center', tilePress)}
          >
            <SlideThumbnail notebook={notebook} />
            {/* A chart in the middle says "presentation" at a glance. */}
            <span className="absolute grid size-12 place-items-center rounded-full bg-ink/80 text-ink-inverse shadow-raised">
              <BarChart3 size={24} />
            </span>
          </button>
        ) : notebook.kind === 'deck' ? (
          <button
            {...open}
            {...draggable}
            className={cn('grid size-full min-w-0 place-items-center pt-[8%]', tilePress)}
          >
            <DeckStack notebook={notebook} />
          </button>
        ) : notebook.kind === 'quiz' ? (
          <button
            {...open}
            {...draggable}
            className={cn('grid w-[86%] min-w-0 place-items-center', tilePress)}
          >
            <QuizCover
              color={fillToCss(notebook.cover)}
              title={notebook.title}
              count={notebook.quiz?.questions.length ?? 0}
              className="w-full"
            />
          </button>
        ) : (
          // Standing upright in the tile.
          <button
            {...open}
            {...draggable}
            className={cn(
              'relative flex aspect-[3/4] h-full min-w-0 flex-col justify-end overflow-hidden rounded-r-card rounded-l-md p-2.5 text-left shadow-raised',
              tilePress,
              light ? 'text-ink-inverse' : 'text-ink',
            )}
            style={{ background: fillToCss(notebook.cover) }}
          >
            <span className="line-clamp-3 text-sm leading-tight font-bold [overflow-wrap:anywhere]">
              {notebook.title}
            </span>
            {pinned ? <PinMark inset /> : null}
            {selected !== undefined ? <SelectMark selected={selected} inset /> : null}
          </button>
        )}
        {pinned && notebook.kind !== undefined && notebook.kind !== 'notebook' ? <PinMark /> : null}
        {selected !== undefined && notebook.kind !== undefined && notebook.kind !== 'notebook' ? (
          <SelectMark selected={selected} />
        ) : null}
      </div>
      <div className={cn('flex items-start justify-between gap-1', TILE_TEXT)}>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{notebook.title}</p>
          <Details notebook={notebook} />
          {showFolder ? <FolderBadge notebook={notebook} folders={folders} /> : null}
        </div>
        <NotebookMenu notebook={notebook} folders={folders} onChanged={onChanged} />
      </div>
    </li>
  )
}

/** When it was edited and how many pages, slides or cards it has; for cards, how many are due. */
function Details({ notebook }: { notebook: Notebook }) {
  const now = useNow()
  const pages = notebook.pageIds.length
  if (notebook.kind === 'deck') {
    const cards = Math.ceil(pages / 2)
    const due = dueCount(notebook, now.getTime())
    return (
      <p className="truncate text-ink-muted">
        {cards} {cards === 1 ? 'card' : 'cards'}
        {due ? (
          <span className="font-semibold text-accent"> · {due} due</span>
        ) : (
          ' · all learned for now'
        )}
      </p>
    )
  }
  if (notebook.kind === 'quiz') {
    const count = notebook.quiz?.questions.length ?? 0
    const best = Math.max(0, ...(notebook.quiz?.results ?? []).map((r) => r.score))
    return (
      <p className="truncate text-ink-muted">
        {count} {count === 1 ? 'question' : 'questions'}
        {best ? ` · best ${best}` : ` · ${formatEdited(notebook.updatedAt)}`}
      </p>
    )
  }
  const unit = notebook.kind === 'presentation' ? 'slide' : 'page'
  return (
    <p className="truncate text-ink-muted">
      {formatEdited(notebook.updatedAt)} · {pages} {unit}
      {pages === 1 ? '' : 's'}
    </p>
  )
}

/** The folder a notebook is in (with the folders around it); a tap looks into it. */
function FolderBadge({ notebook, folders }: { notebook: Notebook; folders: readonly Folder[] }) {
  const path: Folder[] = []
  let id = notebook.folderId
  while (id) {
    const folder = folders.find((f) => f.id === id)
    if (!folder) break
    path.unshift(folder)
    id = folder.parentId
  }
  const folder = path[path.length - 1]
  if (!folder) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openPeek({ kind: 'folder', id: folder.id })
      }}
      title={path.map((f) => f.name).join(' › ')}
      className="mt-1 flex max-w-full items-center gap-1.5 rounded-full bg-surface-sunken py-0.5 pr-2.5 pl-1.5 text-xs font-semibold text-ink-muted hover:bg-pressed"
    >
      <span
        className="grid size-4 shrink-0 place-items-center rounded-full"
        style={{ background: fillToCss(folder.fill) }}
      >
        <FolderClosed size={10} className="text-ink-inverse" />
      </span>
      <span className="truncate">{path.map((f) => f.name).join(' › ')}</span>
    </button>
  )
}

/** A deck: its first card with the next ones stacked behind it. */
function DeckStack({ notebook, small = false }: { notebook: Notebook; small?: boolean }) {
  const shadow = 'absolute inset-0 rounded-md bg-paper shadow-soft ring-1 ring-line'
  return (
    <span className={cn('relative block', small ? 'w-12' : 'w-[78%]')}>
      <span className={cn(shadow, 'translate-x-[6%] -translate-y-[10%] rotate-3')} />
      <span className={cn(shadow, 'translate-x-[3%] -translate-y-[5%] rotate-[1.5deg]')} />
      <span className="relative block overflow-hidden rounded-md shadow-raised ring-1 ring-line">
        <NotebookThumbnail
          notebook={notebook}
          width={small ? 48 : 240}
          className="!w-full rounded-none shadow-none"
        />
      </span>
    </span>
  )
}

/** A notebook as a row of the list view: a small cover, its title and details, its menu. */
export function NotebookRow({
  notebook,
  folders,
  onOpen,
  onChanged,
  onDrop,
  showFolder = false,
  selected,
  many,
}: {
  notebook: Notebook
  folders: readonly Folder[]
  onOpen: () => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
  showFolder?: boolean
  /** Whether it is selected; undefined when not selecting. */
  selected?: boolean
  /** Every selected item, carried along when this one is dragged. */
  many?: { id: string; label: string }[]
}) {
  const drag = useDragState()
  const dragging = drag?.item.kind === 'notebook' && drag.item.id === notebook.id
  const draggable = useDraggable(
    { kind: 'notebook', id: notebook.id, label: notebook.title, many },
    onDrop,
  )
  return (
    <li className={cn('flex items-center gap-1 pr-2 transition-opacity', dragging && 'opacity-40')}>
      <button
        type="button"
        {...draggable}
        onClick={onOpen}
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 px-3 py-2 text-left select-none [-webkit-touch-callout:none]"
      >
        {selected !== undefined ? <SelectMark selected={selected} inline /> : null}
        <span className="grid w-12 shrink-0 place-items-center">
          {notebook.kind === 'presentation' ? (
            <NotebookThumbnail notebook={notebook} width={48} className="!w-12 shadow-soft" />
          ) : notebook.kind === 'deck' ? (
            <DeckStack notebook={notebook} small />
          ) : notebook.kind === 'quiz' ? (
            <QuizCover
              color={fillToCss(notebook.cover)}
              title=""
              count={notebook.quiz?.questions.length ?? 0}
              className="w-12 !p-1 [&>span:first-child]:hidden [&>span:last-child]:hidden"
            />
          ) : (
            <span
              className="block aspect-[3/4] w-9 rounded-r-md rounded-l-sm shadow-soft"
              style={{ background: fillToCss(notebook.cover) }}
            />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{notebook.title}</span>
            {notebook.kind === 'presentation' ? (
              <Presentation
                size={14}
                aria-label="Presentation"
                className="shrink-0 text-ink-muted"
              />
            ) : notebook.kind === 'deck' ? (
              <Layers size={14} aria-label="Flashcards" className="shrink-0 text-ink-muted" />
            ) : notebook.kind === 'quiz' ? (
              <Gamepad2 size={14} aria-label="Quiz" className="shrink-0 text-ink-muted" />
            ) : null}
          </span>
          <Details notebook={notebook} />
        </span>
      </button>
      {showFolder ? (
        <span className="hidden max-w-[40%] sm:block">
          <FolderBadge notebook={notebook} folders={folders} />
        </span>
      ) : null}
      <NotebookMenu notebook={notebook} folders={folders} onChanged={onChanged} className="" />
    </li>
  )
}

function NotebookMenu({
  notebook,
  folders,
  onChanged,
  className = '-mt-2 -mr-2',
}: {
  notebook: Notebook
  folders: readonly Folder[]
  onChanged: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'move' | 'group' | 'delete'>('menu')
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setView('menu')
      }}
    >
      <PopoverTrigger asChild>
        <IconButton
          label={`More for ${notebook.title}`}
          icon={<MoreHorizontal size={20} />}
          className={className}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-1 p-2">
        {view === 'menu' ? (
          <>
            <OrganizeItems
              id={notebook.id}
              label={notebook.title}
              onGroups={() => setView('group')}
              onDone={() => setOpen(false)}
            />
            <Button
              variant="ghost"
              className="justify-start"
              icon={<FolderInput size={18} />}
              onClick={() => setView('move')}
            >
              Move to…
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-danger"
              icon={<Trash2 size={18} />}
              onClick={() => setView('delete')}
            >
              Delete…
            </Button>
          </>
        ) : view === 'group' ? (
          <GroupList id={notebook.id} label={notebook.title} onDone={() => setOpen(false)} />
        ) : view === 'move' ? (
          <MoveList
            folders={folders}
            current={notebook.folderId}
            onPick={async (folderId) => {
              await moveNotebook(notebook.id, folderId)
              setOpen(false)
              onChanged()
            }}
          />
        ) : (
          <div className="grid gap-3 p-2">
            <p className="text-sm">
              Delete <span className="font-semibold">{notebook.title}</span> and all its pages? This
              cannot be undone.
            </p>
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={async () => {
                await deleteNotebook(notebook.id)
                setOpen(false)
                onChanged()
              }}
            >
              Delete {kindName(notebook)}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** A presentation's first slide, as wide as the card. */
function SlideThumbnail({ notebook }: { notebook: Notebook }) {
  return (
    <span className="block w-full overflow-hidden rounded-md shadow-raised">
      <NotebookThumbnail
        notebook={notebook}
        width={480}
        className="!w-full rounded-none shadow-none"
      />
    </span>
  )
}
