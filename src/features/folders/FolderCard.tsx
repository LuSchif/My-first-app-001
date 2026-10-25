import { Copy, FolderInput, FolderOpen, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import {
  Button,
  Dialog,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { formatEdited } from '../../lib/time.ts'
import { deleteFolder, duplicateFolder, moveFolder } from '../../storage/folders.ts'
import { useDraggable, useDragState, type DropTarget } from '../library/dragDrop.ts'
import { countNotebooks, notebooksIn } from '../library/libraryActions.ts'
import { MoveList } from '../library/MoveList.tsx'
import { NotebookThumbnail } from '../library/NotebookThumbnail.tsx'
import { FolderEditorDialog } from './FolderEditorDialog.tsx'
import { FolderGraphic } from './FolderGraphic.tsx'

/** A second tap this soon opens the folder instead of its preview. */
const DOUBLE_TAP_MS = 320
const PREVIEW_COUNT = 3

/**
 * A folder in a grid. A tap opens it in place: the folder tips open and its three most recent
 * notebooks slide out below, each with its first page, title and date. A double tap (or "Open
 * folder" in the preview) shows the whole folder. Hold it to drag it onto or beside another
 * folder.
 */
export function FolderCard({
  folder,
  folders,
  notebooks,
  previewOpen,
  onPreview,
  onOpenFolder,
  onOpenNotebook,
  onChanged,
  onDrop,
  sortable,
}: {
  folder: Folder
  folders: readonly Folder[]
  notebooks: readonly Notebook[]
  previewOpen: boolean
  onPreview: (open: boolean) => void
  onOpenFolder: () => void
  onOpenNotebook: (id: string) => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
  /** Whether dropping a folder beside this one sorts it there. */
  sortable: boolean
}) {
  const lastTap = useRef(0)
  const card = useRef<HTMLLIElement>(null)
  const drag = useDragState()
  const draggable = useDraggable({ kind: 'folder', id: folder.id, label: folder.name }, onDrop)
  const over = drag?.over?.kind === 'folder' && drag.over.id === folder.id ? drag.over.place : null
  const dragging = drag?.item.kind === 'folder' && drag.item.id === folder.id
  const count = countNotebooks(folders, notebooks, folder.id)
  const subfolders = folders.filter((f) => f.parentId === folder.id).length
  const recent = notebooksIn(notebooks, folder.id).slice(0, PREVIEW_COUNT)

  // Tapping anywhere else closes the preview.
  useEffect(() => {
    if (!previewOpen) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (
        card.current?.contains(target) ||
        target?.closest('[data-radix-popper-content-wrapper]')
      ) {
        return
      }
      onPreview(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [previewOpen, onPreview])

  return (
    <li
      ref={card}
      data-drop="folder"
      data-drop-id={folder.id}
      {...(sortable ? { 'data-drop-sort': '' } : {})}
      className={cn(
        'relative grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2 transition-opacity',
        dragging && 'opacity-40',
        previewOpen && 'z-30',
      )}
    >
      {/* Where a dragged folder would be sorted in. */}
      {over === 'before' || over === 'after' ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-2 bottom-12 w-1 rounded-full bg-accent',
            over === 'before' ? '-left-3' : '-right-3',
          )}
        />
      ) : null}
      <button
        type="button"
        aria-label={`${folder.name}, ${count} ${count === 1 ? 'notebook' : 'notebooks'}`}
        aria-expanded={previewOpen}
        {...draggable}
        onClick={() => {
          const now = performance.now()
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0
            onOpenFolder()
            return
          }
          lastTap.current = now
          onPreview(!previewOpen)
        }}
        className={cn(
          'w-full touch-manipulation rounded-card p-1 transition-transform duration-200 ease-gentle select-none [-webkit-touch-callout:none] hover:-translate-y-0.5',
          over === 'inside' && 'scale-105 ring-3 ring-accent',
        )}
      >
        <FolderGraphic
          fill={folder.fill}
          icon={folder.icon}
          open={previewOpen || over === 'inside'}
        />
      </button>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{folder.name}</p>
          <p className="text-ink-muted">
            {count} {count === 1 ? 'notebook' : 'notebooks'}
            {subfolders ? ` · ${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}` : ''}
          </p>
        </div>
        <FolderMenu folder={folder} folders={folders} onChanged={onChanged} />
      </div>
      {previewOpen ? (
        <Preview
          folder={folder}
          recent={recent}
          total={count}
          onOpenFolder={onOpenFolder}
          onOpenNotebook={onOpenNotebook}
          onClose={() => onPreview(false)}
        />
      ) : null}
    </li>
  )
}

/**
 * A folder as a row of the list view: a tap opens it. Hold it to drag it onto another folder,
 * or above or below one to sort it there.
 */
export function FolderRow({
  folder,
  folders,
  notebooks,
  onOpenFolder,
  onChanged,
  onDrop,
  sortable,
}: {
  folder: Folder
  folders: readonly Folder[]
  notebooks: readonly Notebook[]
  onOpenFolder: () => void
  onChanged: () => void
  onDrop: (target: DropTarget) => void
  sortable: boolean
}) {
  const drag = useDragState()
  const draggable = useDraggable({ kind: 'folder', id: folder.id, label: folder.name }, onDrop)
  const over = drag?.over?.kind === 'folder' && drag.over.id === folder.id ? drag.over.place : null
  const dragging = drag?.item.kind === 'folder' && drag.item.id === folder.id
  const count = countNotebooks(folders, notebooks, folder.id)
  const subfolders = folders.filter((f) => f.parentId === folder.id).length
  return (
    <li
      data-drop="folder"
      data-drop-id={folder.id}
      data-drop-axis="y"
      {...(sortable ? { 'data-drop-sort': '' } : {})}
      className={cn(
        'relative flex items-center gap-1 pr-2 transition-opacity',
        dragging && 'opacity-40',
        over === 'inside' && 'bg-hover',
      )}
    >
      {over === 'before' || over === 'after' ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-3 h-1 rounded-full bg-accent',
            over === 'before' ? '-top-0.5' : '-bottom-0.5',
          )}
        />
      ) : null}
      <button
        type="button"
        {...draggable}
        onClick={onOpenFolder}
        className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 px-3 py-2 text-left select-none [-webkit-touch-callout:none]"
      >
        <FolderGraphic
          fill={folder.fill}
          icon={folder.icon}
          open={over === 'inside'}
          className="w-12 shrink-0"
        />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-semibold">{folder.name}</span>
          <span className="block text-ink-muted">
            {count} {count === 1 ? 'notebook' : 'notebooks'}
            {subfolders ? ` · ${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}` : ''}
          </span>
        </span>
      </button>
      <FolderMenu folder={folder} folders={folders} onChanged={onChanged} className="" />
    </li>
  )
}

/** The notebooks sliding out of an opened folder. */
function Preview({
  folder,
  recent,
  total,
  onOpenFolder,
  onOpenNotebook,
  onClose,
}: {
  folder: Folder
  recent: Notebook[]
  total: number
  onOpenFolder: () => void
  onOpenNotebook: (id: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [alignRight, setAlignRight] = useState(false)
  // Near the right edge, the preview opens to the left.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect()
    if (r && r.right > window.innerWidth - 12) setAlignRight(true)
  }, [])
  return (
    <div
      ref={ref}
      role="region"
      aria-label={`${folder.name}: recent notebooks`}
      className={cn(
        'absolute top-[calc(100%-3rem)] z-30 grid w-[max(100%,20rem)] animate-pop-in gap-1 rounded-panel bg-surface-raised p-2 shadow-overlay ring-1 ring-line',
        alignRight ? 'right-0' : 'left-0',
      )}
    >
      {recent.length === 0 ? (
        <p className="px-3 py-4 text-sm text-ink-muted">No notebooks in this folder yet.</p>
      ) : (
        recent.map((notebook, i) => (
          <button
            key={notebook.id}
            type="button"
            onClick={() => onOpenNotebook(notebook.id)}
            className="flex animate-slide-out items-center gap-3 rounded-control p-2 text-left hover:bg-hover"
            style={{ animationDelay: `${120 + i * 70}ms` }}
          >
            <NotebookThumbnail notebook={notebook} width={40} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{notebook.title}</span>
              <span className="block text-sm text-ink-muted">
                Edited {formatEdited(notebook.updatedAt)}
              </span>
            </span>
          </button>
        ))
      )}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-line pt-2">
        <Button variant="primary" size="md" icon={<FolderOpen size={18} />} onClick={onOpenFolder}>
          Open folder{total > PREVIEW_COUNT ? ` (${total})` : ''}
        </Button>
        <IconButton label="Close preview" icon={<X size={20} />} onClick={onClose} />
      </div>
    </div>
  )
}

function FolderMenu({
  folder,
  folders,
  onChanged,
  className = '-mt-2 -mr-2',
}: {
  folder: Folder
  folders: readonly Folder[]
  onChanged: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'move' | 'delete'>('menu')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
      onChanged()
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setView('menu')
        }}
      >
        <PopoverTrigger asChild>
          <IconButton
            label={`More for ${folder.name}`}
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
                icon={<Pencil size={18} />}
                onClick={() => {
                  setOpen(false)
                  setEditing(true)
                }}
              >
                Edit…
              </Button>
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
                className="justify-start"
                icon={<Copy size={18} />}
                disabled={busy}
                onClick={() => void run(() => duplicateFolder(folder.id))}
              >
                Duplicate
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
              current={folder.parentId}
              moving={folder.id}
              onPick={(parentId) => void run(() => moveFolder(folder.id, parentId))}
            />
          ) : (
            <div className="grid gap-2 p-2">
              <p className="text-sm">
                Delete <span className="font-semibold">{folder.name}</span>?
              </p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => deleteFolder(folder.id, true))}
              >
                Delete folder, keep notebooks
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                disabled={busy}
                onClick={() => void run(() => deleteFolder(folder.id, false))}
              >
                Delete with all notebooks
              </Button>
              <p className="text-xs text-ink-muted">
                Kept notebooks and folders move to where this folder was. Deleting with all
                notebooks cannot be undone.
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <Dialog open={editing} onOpenChange={setEditing}>
        {editing ? (
          <FolderEditorDialog
            folder={folder}
            onSaved={() => {
              setEditing(false)
              onChanged()
            }}
          />
        ) : null}
      </Dialog>
    </>
  )
}
