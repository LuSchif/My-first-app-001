import { memo, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CopyPlus,
  Ellipsis,
  Keyboard,
  PenLine,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from '../../../design/icons/icons.tsx'
import {
  BroomitIcon,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '../../../design/index.ts'
import type { Addon, AddonKind } from '../../../engine/addons/types.ts'
import type { Editor } from '../../../engine/editor/Editor.ts'
import { newId } from '../../../engine/model/ids.ts'
import { cn } from '../../../lib/cn.ts'
import { showNotice } from '../../../lib/notices.ts'
import { AddonEditor } from './AddonEditor.tsx'
import { angleText } from './text.ts'
import { CATALOG, catalogEntry } from './catalog.ts'
import {
  freeName,
  isOn,
  moveAddon,
  removeAddon,
  saveAddon,
  switchAddon,
  useAddonLibrary,
  useSwitchedOn,
} from './store.ts'

type Tab = 'mine' | 'browse'

/**
 * The addons bar, on the right beside the page: the person's own addons, each with a switch for
 * this notebook (or marked always on) and an edit button; a browser of the addons Broomit
 * offers; and + to make a new one.
 */
export const AddonsPanel = memo(function AddonsPanel({
  editor,
  notebookId,
  onClose,
}: {
  editor: Editor
  notebookId: string
  onClose: () => void
}) {
  const library = useAddonLibrary()
  const switched = useSwitchedOn(notebookId)
  const [tab, setTab] = useState<Tab>(library.length ? 'mine' : 'browse')
  const [editing, setEditing] = useState<{ addon: Addon; isNew: boolean } | null>(null)
  const [creating, setCreating] = useState(false)

  const startNew = (kind: AddonKind) => {
    setCreating(false)
    const addon = catalogEntry(kind).make()
    setEditing({ addon: { ...addon, name: freeName(addon.name) }, isNew: true })
  }

  return (
    <aside
      aria-label="Addons"
      className="flex h-full w-[min(34vw,24rem)] min-w-[18rem] shrink-0 flex-col border-l border-line bg-surface-raised pt-[env(safe-area-inset-top)]"
    >
      <header className="flex items-center gap-1 px-3 pt-3 pb-2">
        <BroomitIcon name="addons" size={24} colored className="mr-1" />
        <h2 className="min-w-0 flex-1 text-lg font-bold">Addons</h2>
        <IconButton
          label="Make your own addon"
          icon={<Plus size={20} />}
          onClick={() => setCreating(true)}
        />
        <IconButton label="Close addons" icon={<X size={20} />} onClick={onClose} />
      </header>
      <div
        role="tablist"
        aria-label="Addons"
        className="mx-3 grid grid-cols-2 gap-1 rounded-control bg-surface-sunken p-1"
      >
        {(
          [
            ['mine', 'My addons'],
            ['browse', 'Browse'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="h-9 rounded-[calc(var(--radius-control)-4px)] text-sm font-semibold text-ink-muted aria-selected:bg-surface-raised aria-selected:text-ink aria-selected:shadow-soft"
          >
            {label}
            {id === 'mine' && library.length ? ` (${library.length})` : ''}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {tab === 'mine' ? (
          library.length === 0 ? (
            <div className="grid gap-3 rounded-card bg-surface-sunken p-4 text-sm text-ink-muted">
              <p>
                No addons yet. Browse the addons Broomit offers and add the ones you like, or make
                your own with +.
              </p>
              <Button className="justify-self-start" onClick={() => setTab('browse')}>
                Browse addons
              </Button>
            </div>
          ) : (
            <ul className="grid gap-2">
              {library.map((addon, i) => (
                <AddonRow
                  key={addon.id}
                  addon={addon}
                  on={isOn(addon, switched)}
                  first={i === 0}
                  last={i === library.length - 1}
                  onSwitch={(on) => switchAddon(notebookId, addon.id, on)}
                  onEdit={() => setEditing({ addon, isNew: false })}
                  onRun={
                    addon.kind === 'autoRotate'
                      ? () => editor.rotatePageContents(addon.settings.angle)
                      : undefined
                  }
                  onDuplicate={() => {
                    const copy = {
                      ...addon,
                      id: newId(),
                      always: false,
                      name: freeName(`${addon.name} copy`),
                    }
                    setEditing({ addon: copy, isNew: true })
                  }}
                  onMove={(by) => moveAddon(addon.id, by)}
                  onRemove={() => {
                    removeAddon(addon.id)
                    showNotice(`“${addon.name}” is removed from your addons.`)
                  }}
                />
              ))}
            </ul>
          )
        ) : (
          <ul className="grid gap-2">
            {CATALOG.map((entry) => (
              <li key={entry.kind} className="flex gap-3 rounded-card p-3 ring-1 ring-line">
                <KindIcon kind={entry.kind} />
                <div className="grid min-w-0 flex-1 gap-2">
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-sm text-ink-muted">{entry.description}</p>
                  </div>
                  <Button
                    className="justify-self-start"
                    icon={<Plus size={16} />}
                    onClick={() => startNew(entry.kind)}
                  >
                    {entry.kind === 'gesture' || entry.kind === 'textCommand' ? 'Make one' : 'Add'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        {creating ? (
          <DialogContent title="Make your own addon" description="What kind of addon?">
            <ul className="grid gap-2">
              {[...CATALOG].reverse().map((entry) => (
                <li key={entry.kind}>
                  <button
                    type="button"
                    onClick={() => startNew(entry.kind)}
                    className="flex w-full gap-3 rounded-card p-3 text-left ring-1 ring-line hover:bg-hover"
                  >
                    <KindIcon kind={entry.kind} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{entry.name}</span>
                      <span className="block text-sm text-ink-muted">{entry.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <AddonEditor
            key={editing.addon.id}
            addon={editing.addon}
            editor={editor}
            isNew={editing.isNew}
            onCancel={() => setEditing(null)}
            onSave={(addon) => {
              saveAddon(addon)
              // A new addon is on right away in this notebook.
              if (editing.isNew) switchAddon(notebookId, addon.id, true)
              setEditing(null)
              setTab('mine')
            }}
          />
        ) : null}
      </Dialog>
    </aside>
  )
})

function AddonRow({
  addon,
  on,
  first,
  last,
  onSwitch,
  onEdit,
  onRun,
  onDuplicate,
  onMove,
  onRemove,
}: {
  addon: Addon
  on: boolean
  first: boolean
  last: boolean
  onSwitch: (on: boolean) => void
  onEdit: () => void
  onRun?: () => void
  onDuplicate: () => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}) {
  return (
    <li
      className={cn(
        'grid gap-2 rounded-card p-3 ring-1',
        on ? 'bg-surface-sunken ring-line-strong' : 'ring-line',
      )}
    >
      <div className="flex items-center gap-3">
        <KindIcon kind={addon.kind} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{addon.name}</p>
          <p className="truncate text-xs text-ink-muted">{summary(addon)}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${addon.name}${addon.always ? ', always active' : ''}`}
          onClick={() => onSwitch(!on)}
          className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-colors aria-checked:bg-ink "
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-6 rounded-full bg-surface-raised shadow-soft transition-transform',
              on && 'translate-x-5',
            )}
          />
        </button>
      </div>
      <div className="flex items-center gap-1">
        {addon.always ? (
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold">
            {on ? 'Always active' : 'Always active · off here'}
          </span>
        ) : null}
        <span className="flex-1" />
        {onRun && on ? (
          <Button variant="ghost" onClick={onRun}>
            Turn this page
          </Button>
        ) : null}
        <Button variant="ghost" icon={<BroomitIcon name="edit" size={18} />} onClick={onEdit}>
          Edit
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <IconButton label={`More for ${addon.name}`} icon={<Ellipsis size={18} />} />
          </PopoverTrigger>
          <PopoverContent align="end" className="grid w-56 gap-0.5 p-1.5">
            <MenuItem icon={<CopyPlus size={18} />} onClick={onDuplicate}>
              Save a copy as a preset
            </MenuItem>
            {first ? null : (
              <MenuItem icon={<ArrowUp size={18} />} onClick={() => onMove(-1)}>
                Move up
              </MenuItem>
            )}
            {last ? null : (
              <MenuItem icon={<ArrowDown size={18} />} onClick={() => onMove(1)}>
                Move down
              </MenuItem>
            )}
            <MenuItem icon={<Trash2 size={18} />} onClick={onRemove} danger>
              Remove
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>
    </li>
  )
}

function MenuItem({
  icon,
  onClick,
  danger,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <PopoverClose asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-11 items-center gap-2.5 rounded-control px-3 text-left text-sm font-semibold hover:bg-hover',
          danger && 'text-danger',
        )}
      >
        {icon}
        {children}
      </button>
    </PopoverClose>
  )
}

function KindIcon({ kind }: { kind: AddonKind }) {
  const icon =
    kind === 'dateTime' ? (
      <CalendarDays size={22} />
    ) : kind === 'pageNumbers' ? (
      <BroomitIcon name="pages" size={24} colored />
    ) : kind === 'textCommand' ? (
      <Keyboard size={22} />
    ) : kind === 'autoRotate' ? (
      <RotateCcw size={22} className="-scale-x-100" />
    ) : (
      <PenLine size={22} />
    )
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-control bg-surface-sunken text-accent">
      {icon}
    </span>
  )
}

/** One line about what an addon is set to do. */
function summary(addon: Addon): string {
  switch (addon.kind) {
    case 'dateTime': {
      const s = addon.settings
      const parts = [s.showDate ? 'Date' : '', s.showTime ? 'time' : ''].filter(Boolean)
      return parts.length
        ? `${parts.join(' and ')}, ${s.dateSpot.replace('-', ' ')}`
        : 'Shows nothing'
    }
    case 'pageNumbers':
      return `From page ${addon.settings.startPage}, ${addon.settings.spot.replace('-', ' ')}`
    case 'autoRotate':
      return angleText(addon.settings.angle)
    case 'textCommand':
      return `${addon.settings.trigger || '…'} → ${addon.settings.replacement.replace(/\n/g, ' ') || '…'}`
    case 'gesture':
      return `${addon.settings.before.length} ${addon.settings.before.length === 1 ? 'stroke' : 'strokes'} → ${
        addon.settings.after.some((s) => s.tool === 'highlighter') ? 'highlight' : 'drawing'
      }`
  }
}
