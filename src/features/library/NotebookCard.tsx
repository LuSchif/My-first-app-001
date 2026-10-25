import { FolderInput, MoreHorizontal, Presentation, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { fillToCss, prefersLightText } from '../../engine/model/fill.ts'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { formatEdited } from '../../lib/time.ts'
import { moveNotebook } from '../../storage/folders.ts'
import { deleteNotebook } from '../../storage/notebooks.ts'
import { useDraggable, useDragState, type DropTarget } from './dragDrop.ts'
import { MoveList } from './MoveList.tsx'
import { NotebookThumbnail } from './NotebookThumbnail.tsx'

/**
 * A notebook in the library: its cover opens it; hold (or drag with a mouse) to drop it on a
 * folder; the menu moves or deletes it.
 */
export function NotebookCard({
  notebook,
  folders,
  onOpen,
  onChanged,
  onDrop,
}: {
  notebook: Notebook
  folders: readonly Folder[]
  onOpen: () => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
}) {
  const light = prefersLightText(notebook.cover)
  const drag = useDragState()
  const dragging = drag?.item.kind === 'notebook' && drag.item.id === notebook.id
  const draggable = useDraggable(
    { kind: 'notebook', id: notebook.id, label: notebook.title },
    onDrop,
  )
  return (
    // min-w-0: a long title must not widen its column; every card has the column's width.
    <li
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2.5 transition-opacity',
        dragging && 'opacity-40',
      )}
    >
      {notebook.kind === 'presentation' ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${notebook.title}`}
          {...draggable}
          className={cn(
            'relative grid aspect-[3/4] w-full min-w-0 touch-manipulation content-center overflow-hidden rounded-card bg-surface-sunken p-3 select-none [-webkit-touch-callout:none]',
            'transition-transform duration-200 ease-gentle hover:-translate-y-0.5 active:scale-[0.98]',
          )}
        >
          <SlideThumbnail notebook={notebook} />
          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-surface-raised/90 px-2 py-0.5 text-xs font-semibold text-ink-muted shadow-soft">
            <Presentation size={12} /> Presentation
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${notebook.title}`}
          {...draggable}
          className={cn(
            'flex aspect-[3/4] w-full min-w-0 touch-manipulation flex-col justify-end overflow-hidden rounded-r-card rounded-l-md p-3.5 text-left shadow-raised select-none [-webkit-touch-callout:none]',
            'transition-transform duration-200 ease-gentle hover:-translate-y-0.5 active:scale-[0.98]',
            light ? 'text-ink-inverse' : 'text-ink',
          )}
          style={{ background: fillToCss(notebook.cover) }}
        >
          <span className="line-clamp-3 text-lg leading-tight font-bold [overflow-wrap:anywhere]">
            {notebook.title}
          </span>
        </button>
      )}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{notebook.title}</p>
          <p className="text-ink-muted">{notebookDetails(notebook)}</p>
        </div>
        <NotebookMenu notebook={notebook} folders={folders} onChanged={onChanged} />
      </div>
    </li>
  )
}

/** When it was edited, and how many pages or slides it has. */
function notebookDetails(notebook: Notebook): string {
  const pages = notebook.pageIds.length
  const unit = notebook.kind === 'presentation' ? 'slide' : 'page'
  return `${formatEdited(notebook.updatedAt)} · ${pages} ${unit}${pages === 1 ? '' : 's'}`
}

/** A notebook as a row of the list view: a small cover, its title and details, its menu. */
export function NotebookRow({
  notebook,
  folders,
  onOpen,
  onChanged,
  onDrop,
}: {
  notebook: Notebook
  folders: readonly Folder[]
  onOpen: () => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
}) {
  const drag = useDragState()
  const dragging = drag?.item.kind === 'notebook' && drag.item.id === notebook.id
  const draggable = useDraggable(
    { kind: 'notebook', id: notebook.id, label: notebook.title },
    onDrop,
  )
  const slides = notebook.kind === 'presentation'
  return (
    <li className={cn('flex items-center gap-1 pr-2 transition-opacity', dragging && 'opacity-40')}>
      <button
        type="button"
        {...draggable}
        onClick={onOpen}
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 px-3 py-2 text-left select-none [-webkit-touch-callout:none]"
      >
        <span className="grid w-12 shrink-0 place-items-center">
          {slides ? (
            <NotebookThumbnail notebook={notebook} width={48} className="!w-12 shadow-soft" />
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
            {slides ? (
              <Presentation
                size={14}
                aria-label="Presentation"
                className="shrink-0 text-ink-muted"
              />
            ) : null}
          </span>
          <span className="block text-ink-muted">{notebookDetails(notebook)}</span>
        </span>
      </button>
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
  const [view, setView] = useState<'menu' | 'move' | 'delete'>('menu')
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
              Delete notebook
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
