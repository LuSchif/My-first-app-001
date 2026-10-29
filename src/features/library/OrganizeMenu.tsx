import { Check, FolderKanban, Inbox, Pin, PinOff } from 'lucide-react'
import type { Id } from '../../engine/model/types.ts'
import { Button } from '../../design/index.ts'
import { useOrganizer } from './organizer.ts'

/** "Pin" and "Add to group…" in a card's menu, when the card is on a home screen page. */
export function OrganizeItems({
  id,
  label,
  onGroups,
  onDone,
}: {
  id: Id
  label: string
  /** Shows the list of groups instead of the menu. */
  onGroups: () => void
  onDone: () => void
}) {
  const organizer = useOrganizer()
  if (!organizer) return null
  const pinned = organizer.isPinned(id)
  return (
    <>
      <Button
        variant="ghost"
        className="justify-start"
        icon={pinned ? <PinOff size={18} /> : <Pin size={18} />}
        onClick={() => {
          organizer.togglePin(id, label)
          onDone()
        }}
      >
        {pinned ? 'Unpin' : 'Pin'}
      </Button>
      <Button
        variant="ghost"
        className="justify-start"
        icon={<FolderKanban size={18} />}
        onClick={onGroups}
      >
        {organizer.groupOf(id) ? 'Group…' : 'Add to group…'}
      </Button>
    </>
  )
}

/** The groups of the page, to put a card into one (or into none). */
export function GroupList({ id, label, onDone }: { id: Id; label: string; onDone: () => void }) {
  const organizer = useOrganizer()
  if (!organizer) return null
  const current = organizer.groupOf(id)?.id ?? null
  const pick = (groupId: Id | null) => {
    organizer.moveToGroup(id, groupId, label)
    onDone()
  }
  return (
    <div role="listbox" aria-label="Group" className="grid max-h-80 gap-0.5 overflow-y-auto">
      <GroupRow label="No group" selected={current === null} onPick={() => pick(null)}>
        <Inbox size={18} />
      </GroupRow>
      {organizer.tab.groups.map((group) => (
        <GroupRow
          key={group.id}
          label={group.name}
          selected={current === group.id}
          onPick={() => pick(group.id)}
        >
          <FolderKanban size={18} />
        </GroupRow>
      ))}
      {organizer.tab.groups.length === 0 ? (
        <p className="px-3 py-2 text-sm text-ink-muted">
          No groups on this page yet. Make one with “New group” at the top.
        </p>
      ) : null}
    </div>
  )
}

function GroupRow({
  label,
  selected,
  onPick,
  children,
}: {
  label: string
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
      className="flex h-11 items-center gap-2.5 rounded-control px-3 text-left text-sm hover:bg-hover aria-selected:font-semibold"
    >
      <span className="text-ink-muted">{children}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? <Check size={16} /> : null}
    </button>
  )
}
