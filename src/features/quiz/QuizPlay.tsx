import { Check, Pencil, RotateCcw, Trophy, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button, IconButton } from '../../design/index.ts'
import {
  isCorrect,
  playable,
  pointsFor,
  RESULTS_KEPT,
  shuffled,
  type QuizQuestion,
  type QuizResult,
  type Response,
} from '../../engine/model/quiz.ts'
import type { Notebook } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { loadNotebook, saveQuiz } from '../../storage/notebooks.ts'
import { answerColor } from './answerColors.ts'
import { AnswerShape } from './answerStyle.tsx'

interface Answered {
  response: Response
  points: number
  correct: boolean | null
  seconds: number
}

type Phase = 'intro' | 'question' | 'feedback' | 'done'

/** Playing a quiz on this iPad: each question against the clock, then the score. */
export function QuizPlay({ id }: { id: string }) {
  const [notebook, setNotebook] = useState<Notebook | null | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answered[]>([])
  const [round, setRound] = useState(0)

  useEffect(() => {
    let alive = true
    loadNotebook(id)
      .then((data) => alive && setNotebook(data?.notebook ?? null))
      .catch((err: unknown) => {
        console.error(err)
        if (alive) setNotebook(null)
      })
    return () => {
      alive = false
    }
  }, [id])

  const questions = useMemo(() => (notebook?.quiz ? playable(notebook.quiz) : []), [notebook])
  const score = answers.reduce((sum, a) => sum + a.points, 0)

  if (notebook === undefined) return null
  if (!notebook || notebook.kind !== 'quiz' || questions.length === 0) {
    return (
      <Screen color="var(--color-ink)">
        <div className="grid place-items-center gap-4 text-center text-ink-inverse">
          <p className="text-xl font-bold">This quiz has no questions ready to play.</p>
          <Button onClick={() => navigate(notebook ? { name: 'quiz', id } : { name: 'library' })}>
            {notebook ? 'Edit the quiz' : 'Back to the library'}
          </Button>
        </div>
      </Screen>
    )
  }

  const color = notebook.cover.type === 'solid' ? notebook.cover.color : 'var(--color-ink)'
  const question = questions[index]!
  const exit = () => navigate({ name: 'library' })

  if (phase === 'intro') {
    return (
      <Screen color={color} onExit={exit}>
        <div className="grid max-w-xl place-items-center gap-6 text-center text-ink-inverse">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase opacity-80">Quiz</p>
          <h1 className="text-4xl font-bold text-balance">{notebook.title}</h1>
          <p className="text-lg opacity-90">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'} · the faster you
            answer right, the more points
          </p>
          <BestScore notebook={notebook} />
          <button
            type="button"
            onClick={() => setPhase('question')}
            className="h-14 rounded-full bg-ink-inverse px-10 text-lg font-bold text-ink shadow-raised transition-transform active:scale-95"
          >
            Start
          </button>
        </div>
      </Screen>
    )
  }

  if (phase === 'done') {
    const scored = answers.filter((a) => a.correct !== null)
    const right = scored.filter((a) => a.correct).length
    return (
      <Screen color={color} onExit={exit}>
        <div className="grid w-full max-w-2xl gap-6 text-ink-inverse">
          <div className="grid place-items-center gap-2 text-center">
            <Trophy size={48} />
            <p className="text-5xl font-bold tabular-nums">{score}</p>
            <p className="text-lg opacity-90">
              {right} of {scored.length} right
            </p>
          </div>
          <ol className="grid max-h-[45vh] gap-2 overflow-y-auto rounded-card bg-surface-raised p-3 text-ink">
            {questions.map((q, i) => {
              const a = answers[i]
              return (
                <li key={q.id} className="flex items-center gap-3 rounded-control px-2 py-1.5">
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full text-ink-inverse',
                      a?.correct === null
                        ? 'bg-ink-subtle'
                        : a?.correct
                          ? 'bg-correct'
                          : 'bg-incorrect',
                    )}
                  >
                    {a?.correct === false ? <X size={16} /> : <Check size={16} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{q.text}</span>
                  <span className="text-sm text-ink-muted tabular-nums">+{a?.points ?? 0}</span>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              icon={<RotateCcw size={18} />}
              onClick={() => {
                setAnswers([])
                setIndex(0)
                setRound((r) => r + 1)
                setPhase('question')
              }}
            >
              Play again
            </Button>
            <Button icon={<Pencil size={18} />} onClick={() => navigate({ name: 'quiz', id })}>
              Edit quiz
            </Button>
            <Button variant="primary" onClick={exit}>
              Done
            </Button>
          </div>
        </div>
      </Screen>
    )
  }

  const answered = answers[index]
  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1)
      setPhase('question')
      return
    }
    setPhase('done')
    void storeResult(notebook, questions, answers).then(setNotebook)
  }

  return (
    <Screen color={color} onExit={exit}>
      <div className="flex w-full max-w-5xl flex-1 flex-col gap-4">
        <div className="flex items-center justify-between text-sm font-semibold text-ink-inverse">
          <span>
            {index + 1} / {questions.length}
          </span>
          <span className="tabular-nums">{score} points</span>
        </div>
        <div className="rounded-card bg-surface-raised px-6 py-5 text-center shadow-raised">
          <p className="text-2xl font-bold text-balance sm:text-3xl">{question.text}</p>
        </div>
        {phase === 'question' ? (
          <Asking
            key={`${round}-${question.id}`}
            question={question}
            onAnswer={(response, seconds) => {
              const result: Answered = {
                response,
                seconds,
                points: pointsFor(question, response, seconds),
                correct: isCorrect(question, response),
              }
              setAnswers((list) => {
                const copy = [...list]
                copy[index] = result
                return copy
              })
              setPhase('feedback')
            }}
          />
        ) : answered ? (
          <Feedback
            question={question}
            answered={answered}
            last={index + 1 === questions.length}
            onNext={next}
          />
        ) : null}
      </div>
    </Screen>
  )
}

/** The best score so far, from earlier runs. */
function BestScore({ notebook }: { notebook: Notebook }) {
  const results = notebook.quiz?.results ?? []
  if (!results.length) return null
  const best = Math.max(...results.map((r) => r.score))
  return <p className="text-sm font-semibold opacity-90">Your best: {best} points</p>
}

/** Keeps the run with the quiz (newest first, a few runs); returns the updated notebook. */
async function storeResult(
  notebook: Notebook,
  questions: QuizQuestion[],
  answers: Answered[],
): Promise<Notebook> {
  const scored = answers.filter((a) => a.correct !== null)
  const result: QuizResult = {
    at: Date.now(),
    score: answers.reduce((sum, a) => sum + a.points, 0),
    correct: scored.filter((a) => a.correct).length,
    total: questions.filter((q) => q.kind !== 'poll').length,
  }
  const quiz = notebook.quiz!
  const next = { ...quiz, results: [result, ...(quiz.results ?? [])].slice(0, RESULTS_KEPT) }
  try {
    await saveQuiz(notebook.id, { quiz: next })
  } catch (err) {
    console.error(err)
  }
  return { ...notebook, quiz: next }
}

function Screen({
  color,
  onExit,
  children,
}: {
  color: string
  onExit?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto p-6 pt-[calc(1.5rem+env(safe-area-inset-top))]"
      style={{ background: color }}
    >
      {onExit ? (
        <IconButton
          label="Stop playing"
          icon={<X size={22} />}
          onClick={onExit}
          className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 bg-surface-raised/90 shadow-soft"
        />
      ) : null}
      {children}
    </div>
  )
}

/** A question being answered: the clock, and the answers in its kind's way. */
function Asking({
  question,
  onAnswer,
}: {
  question: QuizQuestion
  onAnswer: (response: Response, seconds: number) => void
}) {
  const started = useRef(0)
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
    started.current = performance.now()
    const timer = setInterval(() => {
      const remaining = question.time - (performance.now() - started.current) / 1000
      setLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        clearInterval(timer)
        if (!done.current) {
          done.current = true
          handler.current({ kind: 'none' }, question.time)
        }
      }
    }, 100)
    return () => clearInterval(timer)
  }, [question])

  return (
    <div className="grid flex-1 content-start gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-raised text-xl font-bold tabular-nums shadow-soft">
          {Math.ceil(left)}
        </span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-inverse/25">
          <div
            className="h-full rounded-full bg-ink-inverse transition-[width] duration-100 ease-linear"
            style={{ width: `${(left / question.time) * 100}%` }}
          />
        </div>
      </div>
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
          placeholder="Type your answer"
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
          className="h-14 min-w-0 flex-1 rounded-card bg-surface-raised px-4 text-xl font-semibold shadow-soft focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <SubmitButton disabled={!text.trim()} />
      </form>
    )
  }

  if (question.kind === 'slider' && slider) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-card bg-surface-raised p-6 shadow-soft">
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
    // Tap the items in the right order; a tap on a chosen one takes it back.
    return (
      <div className="grid gap-3">
        <p className="text-center text-sm font-semibold text-ink-inverse">
          Tap the items in the right order
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {mixed.map((a) => {
            const at = chosen.indexOf(a.id)
            const i = answers.indexOf(a)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setChosen((list) => (at >= 0 ? list.filter((x) => x !== a.id) : [...list, a.id]))
                }
                className="flex min-h-16 items-center gap-3 rounded-card px-4 text-left text-lg font-semibold text-ink-inverse shadow-soft transition-transform active:scale-[0.98]"
                style={{ background: answerColor(i) }}
              >
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full font-bold',
                    at >= 0 ? 'bg-ink-inverse text-ink' : 'ring-2 ring-ink-inverse/70',
                  )}
                >
                  {at >= 0 ? at + 1 : ''}
                </span>
                {a.text}
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
    <div className="grid gap-3">
      {several ? (
        <p className="text-center text-sm font-semibold text-ink-inverse">
          Choose every right answer
        </p>
      ) : null}
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
              className={cn(
                'flex min-h-24 items-center gap-4 rounded-card px-5 text-left text-xl font-bold text-ink-inverse shadow-raised transition-transform active:scale-[0.98]',
                several && on && 'ring-4 ring-ink-inverse',
              )}
              style={{ background: answerColor(i) }}
            >
              <AnswerShape index={i} size={30} />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{a.text}</span>
              {several ? (
                <span
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-full ring-2 ring-ink-inverse',
                    on ? 'bg-ink-inverse text-ink' : 'text-transparent',
                  )}
                >
                  <Check size={20} strokeWidth={3} />
                </span>
              ) : null}
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
    <button
      type={onClick ? 'button' : 'submit'}
      disabled={disabled}
      onClick={onClick}
      className="h-14 justify-self-center rounded-full bg-ink-inverse px-10 text-lg font-bold text-ink shadow-raised transition-transform active:scale-95 disabled:opacity-50"
    >
      Submit
    </button>
  )
}

/** Right or wrong, the points, and what the right answer was. */
function Feedback({
  question,
  answered,
  last,
  onNext,
}: {
  question: QuizQuestion
  answered: Answered
  last: boolean
  onNext: () => void
}) {
  const answers = question.answers.filter((a) => a.text.trim())
  const verdict =
    answered.correct === null
      ? { text: 'Thanks for voting!', tone: 'bg-surface-raised text-ink' }
      : answered.response.kind === 'none'
        ? { text: "Time's up", tone: 'bg-incorrect text-ink-inverse' }
        : answered.correct
          ? { text: 'Correct!', tone: 'bg-correct text-ink-inverse' }
          : { text: 'Not quite', tone: 'bg-incorrect text-ink-inverse' }
  let solution: string | null = null
  if (question.kind === 'slider' && question.slider) {
    const s = question.slider
    solution = `${s.correct}${s.unit}${s.tolerance ? ` (±${s.tolerance})` : ''}`
  } else if (question.kind === 'order') {
    solution = answers.map((a, i) => `${i + 1}. ${a.text}`).join('   ')
  } else if (question.kind === 'typed') {
    solution = answers[0]?.text ?? null
  } else if (question.kind !== 'poll') {
    solution = answers
      .filter((a) => a.correct)
      .map((a) => a.text)
      .join(', ')
  }
  return (
    <div className="grid flex-1 content-center justify-items-center gap-5">
      <div
        className={cn(
          'grid min-w-72 justify-items-center gap-1 rounded-card px-8 py-6 shadow-raised',
          verdict.tone,
        )}
      >
        <p className="text-3xl font-bold">{verdict.text}</p>
        {answered.correct !== null ? (
          <p className="text-lg font-semibold tabular-nums">+{answered.points} points</p>
        ) : null}
      </div>
      {solution && !answered.correct ? (
        <p className="max-w-2xl rounded-card bg-surface-raised px-5 py-3 text-center text-lg shadow-soft">
          <span className="font-semibold">Right answer: </span>
          {solution}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onNext}
        className="h-14 rounded-full bg-ink-inverse px-10 text-lg font-bold text-ink shadow-raised transition-transform active:scale-95"
      >
        {last ? 'See results' : 'Next question'}
      </button>
    </div>
  )
}
