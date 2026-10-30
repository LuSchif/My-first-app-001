import { cn } from '../../lib/cn.ts'

/**
 * Broomit's quiz look: questions are written on a ruled sheet, answers are paper cards
 * marked A to F; the accent shows what is chosen.
 */

export type LetterState = 'idle' | 'chosen' | 'right' | 'wrong'

export function AnswerLetter({
  index,
  state = 'idle',
  className,
}: {
  index: number
  state?: LetterState
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-control text-base font-bold transition-colors',
        state === 'idle' && 'bg-surface-sunken text-ink-muted',
        state === 'chosen' && 'bg-accent text-ink-inverse',
        state === 'right' && 'bg-correct text-ink-inverse',
        state === 'wrong' && 'bg-incorrect text-ink-inverse',
        className,
      )}
    >
      {'ABCDEF'[index] ?? index + 1}
    </span>
  )
}

/** A ruled sheet with a margin line, for the question. */
export function QuestionSheet({
  children,
  compact = false,
  className,
}: {
  children: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-card bg-paper pr-6 pl-12 shadow-raised ring-1 ring-line',
        compact ? 'py-3' : 'py-6',
        className,
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0 31px, var(--color-line) 31px 32px)',
        // A rule under each 32 px line of text.
        backgroundPosition: `0 ${compact ? 12 : 24}px`,
      }}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-8 w-px bg-accent/60" />
      {children}
    </div>
  )
}

/** The time left, as a thin line under the question. */
export function TimeLine({ left, total }: { left: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
          style={{ width: `${(left / total) * 100}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm font-semibold text-ink-muted tabular-nums">
        {Math.ceil(left)} s
      </span>
    </div>
  )
}
