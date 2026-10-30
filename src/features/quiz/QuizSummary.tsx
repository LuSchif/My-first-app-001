import { fillToCss, type Fill } from '../../engine/model/fill.ts'
import type { QuizQuestion } from '../../engine/model/quiz.ts'
import { ResultMark, type Answered } from './playParts.tsx'
import { QuizCover } from './QuizCover.tsx'

/** The quiz before it starts: its card, title and how many questions. */
export function QuizIntro({
  title,
  cover,
  count,
  best,
  note,
  children,
}: {
  title: string
  cover: Fill
  count: number
  best?: number | null
  note?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid w-full max-w-md justify-items-center gap-5 rounded-panel bg-surface-raised p-8 text-center shadow-raised ring-1 ring-line">
      <QuizCover color={fillToCss(cover)} title={title} count={count} className="w-56" />
      <h1 className="text-3xl font-bold text-balance">{title}</h1>
      <p className="text-ink-muted">
        {count} {count === 1 ? 'question' : 'questions'} · a right answer earns points, a quick one
        a few more
      </p>
      {best != null ? <p className="text-sm font-semibold">Your best: {best} points</p> : null}
      {note}
      {children}
    </div>
  )
}

/** The end of a run: the score, and each question right or wrong. */
export function QuizSummary({
  questions,
  answers,
  children,
  side,
}: {
  questions: QuizQuestion[]
  answers: (Answered | undefined)[]
  children?: React.ReactNode
  /** Shown next to the score, e.g. the ranking of a game with friends. */
  side?: React.ReactNode
}) {
  const score = answers.reduce((sum, a) => sum + (a?.points ?? 0), 0)
  const scored = answers.filter((a) => a && a.correct !== null)
  const right = scored.filter((a) => a?.correct).length
  return (
    <div className="grid w-full max-w-2xl gap-5">
      <div className="grid justify-items-center gap-1 rounded-panel bg-surface-raised p-6 text-center shadow-raised ring-1 ring-line">
        <p className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Your score
        </p>
        <p className="text-5xl font-bold tabular-nums">{score}</p>
        <p className="text-ink-muted">
          {right} of {scored.length} right
        </p>
      </div>
      {side}
      <ol className="grid max-h-[45vh] gap-1 overflow-y-auto rounded-card bg-surface-raised p-3 shadow-soft ring-1 ring-line">
        {questions.map((q, i) => {
          const a = answers[i]
          return (
            <li key={q.id} className="flex items-center gap-3 rounded-control px-2 py-1.5">
              <ResultMark correct={a ? a.correct : false} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{q.text}</span>
              <span className="text-sm text-ink-muted tabular-nums">+{a?.points ?? 0}</span>
            </li>
          )
        })}
      </ol>
      {children ? <div className="flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}
