import { Copy, FolderInput, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { deleteFolder, duplicateFolder, moveFolder } from '../../storage/folders.ts'
import { useDraggable, useDragState, type DropTarget } from '../library/dragDrop.ts'
import { countNotebooks } from '../library/libraryActions.ts'
import { MoveList } from '../library/MoveList.tsx'
import { useOrganizer } from '../library/organizer.ts'
import { GroupList, OrganizeItems } from '../library/OrganizeMenu.tsx'
import { PinMark, TILE_TEXT } from '../library/NotebookCard.tsx'
import { FolderEditorDialog } from './FolderEditorDialog.tsx'
import { FolderGraphic } from './FolderGraphic.tsx'

/**
 * A folder in a grid. A tap takes a look inside (see `Peek.tsx`); hold it to drag it onto or
 * beside another folder.
 */
export function FolderCard({
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
  /** Whether dropping a folder beside this one sorts it there. */
  sortable: boolean
}) {
  const drag = useDragState()
  const draggable = useDraggable({ kind: 'folder', id: folder.id, label: folder.name }, onDrop)
  const over = drag?.over?.kind === 'folder' && drag.over.id === folder.id ? drag.over.place : null
  const dragging = drag?.item.kind === 'folder' && drag.item.id === folder.id
  const count = countNotebooks(folders, notebooks, folder.id)
  const subfolders = folders.filter((f) => f.parentId === folder.id).length
  const pinned = useOrganizer()?.isPinned(folder.id) ?? false

  return (
    <li
      data-drop="folder"
      data-drop-id={folder.id}
      {...(sortable ? { 'data-drop-sort': '' } : {})}
      className={cn(
        'relative grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-2.5 transition-opacity',
        dragging && 'opacity-40',
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
        {...draggable}
        onClick={onOpenFolder}
        className={cn(
          'w-full touch-manipulation rounded-card p-1 transition-transform duration-200 ease-gentle select-none [-webkit-touch-callout:none] hover:-translate-y-0.5',
          over === 'inside' && 'scale-105 ring-3 ring-accent',
        )}
      >
        <FolderGraphic fill={folder.fill} icon={folder.icon} open={over === 'inside'} />
      </button>
      {pinned ? <PinMark /> : null}
      <div className={cn('flex items-start justify-between gap-1', TILE_TEXT)}>
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{folder.name}</p>
          <p className="text-ink-muted">
            {count} {count === 1 ? 'notebook' : 'notebooks'}
            {subfolders ? ` · ${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}` : ''}
          </p>
        </div>
        <FolderMenu folder={folder} folders={folders} onChanged={onChanged} />
      </div>
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
  const [view, setView] = useState<'menu' | 'move' | 'group' | 'delete'>('menu')
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
              <OrganizeItems
                id={folder.id}
                label={folder.name}
                onGroups={() => setView('group')}
                onDone={() => setOpen(false)}
              />
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
          ) : view === 'group' ? (
            <GroupList id={folder.id} label={folder.name} onDone={() => setOpen(false)} />
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
