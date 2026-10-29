import { CheckCheck, FolderInput, FolderKanban, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import type { Folder, Id } from '../../engine/model/types.ts'
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { withDescendants } from '../../storage/folders.ts'
import type { HomeTab } from './homeTabs.ts'
import { MoveList } from './MoveList.tsx'

/** "Select" in a page's header: starts or ends choosing several items. */
export function SelectButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-ink-muted hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
    >
      <CheckCheck size={16} />
      {active ? 'Done' : 'Select'}
    </button>
  )
}

/**
 * The bar at the bottom of the page while selecting: how many are chosen, choose all, and what
 * to do with them (move into a folder, put into a group, delete).
 */
export function SelectionBar({
  kind,
  ids,
  total,
  folders,
  tab,
  onSelectAll,
  onMove,
  onGroup,
  onDelete,
  onCancel,
}: {
  kind: 'folder' | 'notebook'
  ids: Id[]
  /** How many items the page has. */
  total: number
  folders: readonly Folder[]
  tab: HomeTab
  onSelectAll: () => void
  onMove: (folderId: Id | null) => void
  onGroup: (groupId: Id | null) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [moving, setMoving] = useState(false)
  const [grouping, setGrouping] = useState(false)
  const none = ids.length === 0
  // Folders never go into themselves or their own folders.
  const excluded = new Set<Id>()
  if (kind === 'folder') {
    for (const id of ids) for (const f of withDescendants(folders, id)) excluded.add(f)
  }
  return (
    <div
      data-keep-keyboard=""
      className="absolute inset-x-3 bottom-3 z-20 flex animate-pop-in flex-wrap items-center gap-1 rounded-card bg-surface-raised p-2 shadow-overlay ring-1 ring-line"
    >
      <IconButton label="Stop selecting" icon={<X size={20} />} onClick={onCancel} />
      <span className="mr-auto px-1 text-sm font-semibold">{ids.length} selected</span>
      {ids.length < total ? (
        <Button variant="ghost" onClick={onSelectAll}>
          Select all
        </Button>
      ) : null}
      <Popover open={moving} onOpenChange={setMoving}>
        <PopoverTrigger asChild>
          <Button variant="ghost" icon={<FolderInput size={18} />} disabled={none}>
            Move to…
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-72 p-2">
          <MoveList
            folders={folders.filter((f) => !excluded.has(f.id))}
            current={undefined}
            onPick={(folderId) => {
              setMoving(false)
              onMove(folderId)
            }}
          />
        </PopoverContent>
      </Popover>
      {tab.groups.length ? (
        <Popover open={grouping} onOpenChange={setGrouping}>
          <PopoverTrigger asChild>
            <Button variant="ghost" icon={<FolderKanban size={18} />} disabled={none}>
              Group…
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="grid w-64 gap-0.5 p-2">
            {[{ id: null, name: 'No group' }, ...tab.groups].map((g) => (
              <button
                key={g.id ?? 'none'}
                type="button"
                onClick={() => {
                  setGrouping(false)
                  onGroup(g.id)
                }}
                className="flex h-11 items-center rounded-control px-3 text-left text-sm hover:bg-hover"
              >
                <span className="truncate">{g.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
      <Button variant="danger" icon={<Trash2 size={18} />} disabled={none} onClick={onDelete}>
        Delete
      </Button>
    </div>
  )
}
