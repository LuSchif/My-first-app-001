import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, IconButton } from '../../design/index.ts'
import { shuffled, solutionOf, type QuizQuestion, type Response } from '../../engine/model/quiz.ts'
import { cn } from '../../lib/cn.ts'
import { AnswerLetter, QuestionSheet, TimeLine } from './cards.tsx'
import { answerCard } from './quizLook.ts'

/** How a question was answered. */
export interface Answered {
  response: Response
  points: number
  correct: boolean | null
  seconds: number
}

/** The screen a quiz is played on: the app's own background, a close button, a top line. */
export function PlayScreen({
  onExit,
  exitLabel = 'Stop playing',
  top,
  children,
}: {
  onExit?: () => void
  exitLabel?: string
  top?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center gap-4 overflow-y-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-8 sm:px-8">
      <div className="flex min-h-11 w-full max-w-5xl items-center gap-3">
        {onExit ? (
          <IconButton
            label={exitLabel}
            icon={<X size={22} />}
            onClick={onExit}
            className="bg-surface-raised shadow-soft ring-1 ring-line"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 text-sm font-semibold text-ink-muted">
          {top}
        </div>
      </div>
      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-5">
        {children}
      </div>
    </div>
  )
}

export function QuestionHeading({ question }: { question: QuizQuestion }) {
  return (
    <QuestionSheet className="w-full">
      <p className="text-2xl leading-8 font-bold text-balance sm:text-3xl sm:leading-8">
        {question.text}
      </p>
    </QuestionSheet>
  )
}

/**
 * A question being answered: the time left, its picture, and the answers in its kind's way.
 * `startedAt` (from `performance.now()`) lets the clock start when the question was shown.
 */
export function Asking({
  question,
  onAnswer,
  startedAt,
}: {
  question: QuizQuestion
  onAnswer: (response: Response, seconds: number) => void
  startedAt?: number
}) {
  const started = useRef(startedAt ?? 0)
  const done = useRef(false)
  // The latest handler, so the clock is not restarted when the parent draws again.
  const handler = useRef(onAnswer)
  useEffect(() => {
    handler.current = onAnswer
  })
  const [left, setLeft] = useState(question.time)
  const answer = (response: Response) => {
    if (done.current) return
    done.current = true
    handler.current(response, (performance.now() - started.current) / 1000)
  }
  useEffect(() => {
    if (!startedAt) started.current = performance.now()
    const tick = () => {
      const remaining = question.time - (performance.now() - started.current) / 1000
      setLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        clearInterval(timer)
        if (!done.current) {
          done.current = true
          handler.current({ kind: 'none' }, question.time)
        }
      }
    }
    const timer = setInterval(tick, 100)
    tick()
    return () => clearInterval(timer)
  }, [question, startedAt])

  return (
    <div className="grid w-full content-start gap-4">
      <TimeLine left={left} total={question.time} />
      {question.image ? (
        <img
          src={question.image}
          alt=""
          className="max-h-[28vh] justify-self-center rounded-card object-contain shadow-soft"
        />
      ) : null}
      <AnswerInput question={question} onAnswer={answer} />
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-sm font-semibold text-ink-muted">{children}</p>
}

function AnswerInput({
  question,
  onAnswer,
}: {
  question: QuizQuestion
  onAnswer: (response: Response) => void
}) {
  const answers = question.answers.filter((a) => a.text.trim())
  const [chosen, setChosen] = useState<string[]>([])
  const [text, setText] = useState('')
  const slider = question.slider
  const [value, setValue] = useState(slider ? (slider.min + slider.max) / 2 : 0)
  // Shuffled once for this question (the component is new for every question).
  const [mixed] = useState(() => shuffled(answers))

  if (question.kind === 'typed') {
    return (
      <form
        className="mx-auto flex w-full max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) onAnswer({ kind: 'text', text })
        }}
      >
        <input
          aria-label="Your answer"
          placeholder="Write your answer"
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
          className="h-14 min-w-0 flex-1 rounded-card bg-surface-raised px-4 text-xl font-semibold shadow-soft ring-1 ring-line focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <SubmitButton disabled={!text.trim()} />
      </form>
    )
  }

  if (question.kind === 'slider' && slider) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-card bg-surface-raised p-6 shadow-soft ring-1 ring-line">
        <p className="text-center text-4xl font-bold tabular-nums">
          {value}
          {slider.unit}
        </p>
        <input
          type="range"
          aria-label="Your answer"
          min={slider.min}
          max={slider.max}
          step={slider.step > 0 ? slider.step : 1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-sm text-ink-muted">
          <span>
            {slider.min}
            {slider.unit}
          </span>
          <span>
            {slider.max}
            {slider.unit}
          </span>
        </div>
        <SubmitButton onClick={() => onAnswer({ kind: 'number', value })} />
      </div>
    )
  }

  if (question.kind === 'order') {
    // Tap the cards in the right order; a tap on a numbered one takes it back.
    return (
      <div className="grid w-full gap-3">
        <Hint>Tap the cards in the right order</Hint>
        <div className="grid gap-2 sm:grid-cols-2">
          {mixed.map((a) => {
            const at = chosen.indexOf(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setChosen((list) => (at >= 0 ? list.filter((x) => x !== a.id) : [...list, a.id]))
                }
                className={cn(answerCard(at >= 0, true), 'active:scale-[0.98]')}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-control font-bold',
                    at >= 0 ? 'bg-accent text-ink-inverse' : 'bg-surface-sunken text-ink-subtle',
                  )}
                >
                  {at >= 0 ? at + 1 : '·'}
                </span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{a.text}</span>
              </button>
            )
          })}
        </div>
        <SubmitButton
          disabled={chosen.length !== answers.length}
          onClick={() => onAnswer({ kind: 'order', ids: chosen })}
        />
      </div>
    )
  }

  const several = question.kind === 'multiple'
  return (
    <div className="grid w-full gap-3">
      {several ? <Hint>Choose every right card</Hint> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {answers.map((a, i) => {
          const on = chosen.includes(a.id)
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={several ? on : undefined}
              onClick={() => {
                if (!several) {
                  onAnswer({ kind: 'choice', ids: [a.id] })
                  return
                }
                setChosen((list) => (on ? list.filter((x) => x !== a.id) : [...list, a.id]))
              }}
              className={cn(answerCard(on), 'text-xl hover:shadow-raised active:scale-[0.98]')}
            >
              <AnswerLetter index={i} state={on ? 'chosen' : 'idle'} />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{a.text}</span>
            </button>
          )
        })}
      </div>
      {several ? (
        <SubmitButton
          disabled={chosen.length === 0}
          onClick={() => onAnswer({ kind: 'choice', ids: chosen })}
        />
      ) : null}
    </div>
  )
}

function SubmitButton({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return (
    <Button
      type={onClick ? 'button' : 'submit'}
      variant="primary"
      size="lg"
      disabled={disabled}
      onClick={onClick}
      className="min-w-40 justify-self-center"
    >
      Done
    </Button>
  )
}

/** Right or wrong, the points, and the right answer when it was missed. */
export function Verdict({ question, answered }: { question: QuizQuestion; answered: Answered }) {
  const verdict =
    answered.correct === null
      ? { text: 'Thanks for your opinion', tone: 'text-ink', icon: null }
      : answered.response.kind === 'none'
        ? { text: 'Out of time', tone: 'text-incorrect', icon: <X size={28} strokeWidth={3} /> }
        : answered.correct
          ? { text: 'Right!', tone: 'text-correct', icon: <Check size={28} strokeWidth={3} /> }
          : { text: 'Not this time', tone: 'text-incorrect', icon: <X size={28} strokeWidth={3} /> }
  const solution = solutionOf(question)
  return (
    <div className="grid w-full max-w-xl justify-items-center gap-3 rounded-card bg-surface-raised px-8 py-6 text-center shadow-raised ring-1 ring-line">
      <p className={cn('flex items-center gap-2 text-3xl font-bold', verdict.tone)}>
        {verdict.icon}
        {verdict.text}
      </p>
      {answered.correct !== null ? (
        <p className="text-lg font-semibold text-ink-muted tabular-nums">
          +{answered.points} points
        </p>
      ) : null}
      {solution && !answered.correct ? (
        <p className="text-base">
          <span className="font-semibold">Right answer: </span>
          {solution}
        </p>
      ) : null}
    </div>
  )
}

/** A dot for a question in the results: right, wrong, or an opinion. */
export function ResultMark({ correct }: { correct: boolean | null | undefined }) {
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full text-ink-inverse',
        correct == null ? 'bg-ink-subtle' : correct ? 'bg-correct' : 'bg-incorrect',
      )}
    >
      {correct === false ? <X size={16} /> : <Check size={16} />}
    </span>
  )
}
