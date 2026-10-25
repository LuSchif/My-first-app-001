import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

/** A design option that folds away: its name and current choice, and below them, its controls. */
export function Fold({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-card ring-1 ring-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-12 w-full items-center gap-3 rounded-card px-4 text-left text-sm font-semibold hover:bg-hover"
      >
        <span className="flex-1">{title}</span>
        {summary}
        <ChevronDown
          size={18}
          className={cn('text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="border-t border-line p-4">{children}</div> : null}
    </div>
  )
}
