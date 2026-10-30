import { cn } from '../../lib/cn.ts'
import { answerColor } from './answerColors.ts'
import { AnswerShape } from './answerStyle.tsx'

/** A quiz as a card: its color, title and the four answer shapes, and how many questions. */
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
        'relative grid aspect-[4/3] content-between overflow-hidden rounded-card p-3 text-left text-ink-inverse shadow-raised',
        className,
      )}
      style={{ background: color }}
    >
      <span className="line-clamp-2 text-sm leading-tight font-bold [overflow-wrap:anywhere]">
        {title}
      </span>
      <span className="grid grid-cols-2 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="grid h-5 place-items-center rounded-md"
            style={{ background: answerColor(i) }}
          >
            <AnswerShape index={i} size={11} />
          </span>
        ))}
      </span>
      <span className="absolute top-2.5 right-2.5 rounded-full bg-ink-inverse/20 ring-1 ring-ink-inverse/40 px-2 py-0.5 text-[10px] font-semibold">
        {count} {count === 1 ? 'question' : 'questions'}
      </span>
    </span>
  )
}
