import { ChevronDown, FolderKanban, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  TextField,
} from '../../design/index.ts'
import { newId } from '../../engine/model/ids.ts'
import { cn } from '../../lib/cn.ts'
import { showNotice } from '../../lib/notices.ts'
import { useDragState } from './dragDrop.ts'
import {
  addGroup,
  MAX_PINS,
  removeGroup,
  updateGroup,
  type HomeGroup,
  type HomeTab,
} from './homeTabs.ts'

/** The pinned items of a page, apart from the rest and set off in the accent color. */
export function PinnedSection({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <section
      aria-label="Pinned"
      className="grid gap-3 rounded-card bg-surface-sunken p-3 ring-2 ring-accent/60"
    >
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
        <Pin size={13} className="fill-current text-accent" /> Pinned
        <span className="ml-auto tracking-normal normal-case">
          {count} of {MAX_PINS}
        </span>
      </h3>
      {children}
    </section>
  )
}

/**
 * A group of a page: its name opens and closes it; what is dragged onto it goes into it. Its
 * menu renames it, shows it as a page of its own, or removes it (its items stay on the page).
 */
export function GroupSection({
  group,
  count,
  tab,
  onChange,
  children,
}: {
  group: HomeGroup
  count: number
  tab: HomeTab
  onChange: (next: HomeTab) => void
  children: React.ReactNode
}) {
  const drag = useDragState()
  const over = drag?.over?.kind === 'group' && drag.over.id === group.id
  const open = !group.collapsed
  return (
    <section
      aria-label={group.name}
      data-drop="group"
      data-drop-id={group.id}
      className={cn(
        'grid gap-3 rounded-card p-2 ring-1 ring-line transition-colors',
        over && 'bg-hover ring-2 ring-accent',
      )}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onChange(updateGroup(tab, group.id, { collapsed: open }))}
          className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-control px-2 text-left hover:bg-hover"
        >
          <ChevronDown
            size={18}
            className={cn(
              'shrink-0 text-ink-muted transition-transform duration-200',
              !open && '-rotate-90',
            )}
          />
          <FolderKanban size={16} className="shrink-0 text-ink-muted" />
          <span className="truncate text-sm font-bold">{group.name}</span>
          <span className="shrink-0 text-sm text-ink-muted">{count}</span>
        </button>
        <GroupMenu group={group} tab={tab} onChange={onChange} />
      </div>
      {open ? (
        count ? (
          <div className="px-1 pb-1">{children}</div>
        ) : (
          <p className="mx-1 mb-1 rounded-control px-3 py-6 text-center text-sm text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
            Hold something on this page and drop it here, or use “Add to group…” in its menu.
          </p>
        )
      ) : null}
    </section>
  )
}

function GroupMenu({
  group,
  tab,
  onChange,
}: {
  group: HomeGroup
  tab: HomeTab
  onChange: (next: HomeTab) => void
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'rename'>('menu')
  const [name, setName] = useState(group.name)
  const rename = () => {
    const trimmed = name.trim()
    if (trimmed) onChange(updateGroup(tab, group.id, { name: trimmed }))
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setView('menu')
          setName(group.name)
        }
      }}
    >
      <PopoverTrigger asChild>
        <IconButton label={`More for ${group.name}`} icon={<MoreHorizontal size={20} />} />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-72 gap-1 p-2">
        {view === 'menu' ? (
          <>
            <Button
              variant="ghost"
              className="justify-start"
              icon={<Pencil size={18} />}
              onClick={() => setView('rename')}
            >
              Rename…
            </Button>
            <div className="px-2">
              <Switch
                label="Show as its own page"
                hint="A page of its own in the row of pages below"
                checked={group.ownTab}
                onChange={(ownTab) => onChange(updateGroup(tab, group.id, { ownTab }))}
              />
            </div>
            <Button
              variant="ghost"
              className="justify-start text-danger"
              icon={<Trash2 size={18} />}
              onClick={() => {
                setOpen(false)
                onChange(removeGroup(tab, group.id))
                showNotice(`Removed group “${group.name}”. What was in it stays on the page.`, {
                  label: 'Undo',
                  run: () => onChange(tab),
                })
              }}
            >
              Remove group
            </Button>
          </>
        ) : (
          <form
            className="grid gap-3 p-1"
            onSubmit={(e) => {
              e.preventDefault()
              rename()
            }}
          >
            <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="primary" disabled={!name.trim()}>
              Rename
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Makes a new group on a page, e.g. "School". */
export function NewGroupButton({
  tab,
  onChange,
}: {
  tab: HomeTab
  onChange: (next: HomeTab) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const create = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChange(
      addGroup(tab, { id: newId(), name: trimmed, itemIds: [], collapsed: false, ownTab: false }),
    )
    setName('')
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-ink-muted hover:bg-hover"
        >
          <Plus size={16} />
          New group
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <TextField
            label="Group name"
            placeholder="e.g. School"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-ink-muted">
            Groups sit at the top of this page. Hold something and drop it onto a group to put it
            there.
          </p>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Create group
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
