import { createElement } from 'react'
import { Check, Inbox } from 'lucide-react'
import type { Folder, Id } from '../../engine/model/types.ts'
import { withDescendants } from '../../storage/folders.ts'
import { folderIcon } from '../folders/folderIcons.ts'
import { folderTree } from './libraryActions.ts'

/**
 * Where to move a notebook or folder: no folder, or any folder (a folder never into itself or
 * its own folders). The current place is marked.
 */
export function MoveList({
  folders,
  current,
  moving,
  onPick,
}: {
  folders: readonly Folder[]
  /** The folder the item is in now (null: none). */
  current: Id | null
  /** A folder being moved; it and its folders are left out. */
  moving?: Id
  onPick: (folderId: Id | null) => void
}) {
  const excluded = moving ? withDescendants(folders, moving) : new Set<Id>()
  const rows = folderTree(folders).filter(({ folder }) => !excluded.has(folder.id))
  return (
    <div role="listbox" aria-label="Move to" className="grid max-h-80 gap-0.5 overflow-y-auto">
      <Row label="No folder" depth={0} selected={current === null} onPick={() => onPick(null)}>
        <Inbox size={18} />
      </Row>
      {rows.map(({ folder, depth }) => (
        <Row
          key={folder.id}
          label={folder.name}
          depth={depth}
          selected={current === folder.id}
          onPick={() => onPick(folder.id)}
        >
          {createElement(folderIcon(folder.icon), { size: 18 })}
        </Row>
      ))}
    </div>
  )
}

function Row({
  label,
  depth,
  selected,
  onPick,
  children,
}: {
  label: string
  depth: number
  selected: boolean
  onPick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      style={{ paddingLeft: 12 + depth * 18 }}
      className="flex h-11 items-center gap-2.5 rounded-control pr-3 text-left text-sm hover:bg-hover aria-selected:font-semibold"
    >
      <span className="text-ink-muted">{children}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? <Check size={16} /> : null}
    </button>
  )
}
