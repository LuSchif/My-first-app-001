import { ChevronLeft } from 'lucide-react'
import type { Folder } from '../../engine/model/types.ts'
import { openPeek } from './peek.ts'

/** Back to the folder this is in, as a peek. */
export function BackToFolder({ folder }: { folder: Folder | undefined }) {
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

/** The left part: the item itself, its name and the button to open it. */
export function Side({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-4 border-line bg-surface p-5 max-md:border-b md:w-[22rem] md:border-r">
      {children}
    </div>
  )
}

/** The right part: what is inside, scrolling on its own. */
export function Contents({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h2 className="px-5 pt-5 pb-3 text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
    </div>
  )
}
