import { cn } from '../../lib/cn.ts'

/** A quiz as a card: a ruled question sheet on its color, with the title and two answers. */
export function QuizCover({
  color,
  title,
  count,
  className,
}: {
  color: string
  title: string
  count: number
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative grid aspect-[4/3] overflow-hidden rounded-card p-2.5 text-left shadow-raised',
        className,
      )}
      style={{ background: color }}
    >
      <span className="relative grid content-between overflow-hidden rounded-[0.8rem] bg-paper py-2 pr-2 pl-5 text-ink">
        <span aria-hidden="true" className="absolute inset-y-0 left-3 w-px bg-accent/60" />
        <span className="line-clamp-2 text-sm leading-tight font-bold [overflow-wrap:anywhere]">
          {title}
        </span>
        <span className="grid gap-1">
          {['A', 'B'].map((letter) => (
            <span key={letter} className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded-[0.3rem] bg-surface-sunken text-[9px] font-bold text-ink-muted">
                {letter}
              </span>
              <span className="h-1.5 flex-1 rounded-full bg-line" />
            </span>
          ))}
        </span>
        <span className="absolute top-1.5 right-1.5 rounded-full bg-surface-sunken px-1.5 py-0.5 text-[9px] font-semibold text-ink-muted">
          {count} {count === 1 ? 'question' : 'questions'}
        </span>
      </span>
    </span>
  )
}
