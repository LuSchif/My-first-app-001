import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  ImagePlus,
  Minus,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { navigate } from '../../app/router.ts'
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  TextField,
} from '../../design/index.ts'
import { newId } from '../../engine/model/ids.ts'
import {
  addAnswer,
  changeKind,
  createQuestion,
  MAX_ANSWERS,
  POINTS_QUICK,
  POINTS_RIGHT,
  playable,
  QUESTION_KINDS,
  questionProblem,
  TIME_LIMITS,
  toggleCorrect,
  type QuestionKind,
  type QuizData,
  type QuizQuestion,
} from '../../engine/model/quiz.ts'
import type { Notebook } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { showNotice } from '../../lib/notices.ts'
import { loadNotebook, saveQuiz } from '../../storage/notebooks.ts'
import { answerCard, KIND_ICONS } from './quizLook.ts'
import { AnswerLetter, QuestionSheet } from './cards.tsx'
import { pictureDataUrl } from './quizImages.ts'

/** Edits are written this long after the last change. */
const SAVE_DELAY_MS = 600

/**
 * Making a quiz, laid out like the presentation editor: the questions on the left, the
 * question being edited in the middle (as players will see it), and its settings on the right.
 */
export function QuizEditor({ id }: { id: string }) {
  const [notebook, setNotebook] = useState<Notebook | null | undefined>(undefined)
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<{ quiz: QuizData; title: string } | null>(null)

  useEffect(() => {
    let alive = true
    loadNotebook(id)
      .then((data) => {
        if (!alive) return
        const nb = data?.notebook ?? null
        setNotebook(nb)
        if (nb?.kind === 'quiz') {
          setQuiz(nb.quiz ?? { questions: [createQuestion()] })
          setTitle(nb.title)
        }
      })
      .catch((err: unknown) => {
        console.error(err)
        if (alive) setNotebook(null)
      })
    return () => {
      alive = false
    }
  }, [id])

  // Unsaved edits are written when leaving.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current)
      const p = pending.current
      if (p) void saveQuiz(id, { quiz: p.quiz, title: p.title })
    },
    [id],
  )

  const persist = (nextQuiz: QuizData, nextTitle: string) => {
    pending.current = { quiz: nextQuiz, title: nextTitle }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const p = pending.current
      pending.current = null
      if (!p) return
      saveQuiz(id, { quiz: p.quiz, title: p.title }).catch((err: unknown) => {
        console.error(err)
        showNotice('The quiz could not be saved. Check that storage is not full.')
      })
    }, SAVE_DELAY_MS)
  }

  if (notebook === undefined) return null
  if (!notebook || notebook.kind !== 'quiz' || !quiz) {
    return (
      <div className="grid min-h-full place-items-center p-8 text-center">
        <div className="grid gap-3">
          <p className="text-lg font-semibold">This quiz is not here any more.</p>
          <Button onClick={() => navigate({ name: 'library' })}>Back to the library</Button>
        </div>
      </div>
    )
  }

  const questions = quiz.questions
  const index = Math.min(selected, questions.length - 1)
  const question = questions[index]!
  const update = (next: QuizData) => {
    setQuiz(next)
    persist(next, title)
  }
  const setQuestion = (q: QuizQuestion) =>
    update({ ...quiz, questions: questions.map((x, i) => (i === index ? q : x)) })
  const insert = (q: QuizQuestion, at: number) => {
    const list = [...questions]
    list.splice(at, 0, q)
    update({ ...quiz, questions: list })
    setSelected(at)
  }
  const ready = playable(quiz).length

  return (
    <div className="fixed inset-0 flex flex-col bg-surface pt-[env(safe-area-inset-top)]">
      <header className="flex items-center gap-3 border-b border-line bg-surface-raised px-4 py-2.5">
        <IconButton
          label="Back to the library"
          icon={<ChevronLeft size={22} />}
          onClick={() => navigate({ name: 'library' })}
        />
        <input
          aria-label="Quiz title"
          value={title}
          maxLength={80}
          onChange={(e) => {
            setTitle(e.target.value)
            persist(quiz, e.target.value.trim() ? e.target.value : notebook.title)
          }}
          className="h-11 min-w-0 flex-1 rounded-control bg-transparent px-2 text-lg font-bold hover:bg-hover focus:bg-surface focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <span className="hidden text-sm text-ink-muted sm:block">
          {ready} of {questions.length} ready to play
        </span>
        <Button
          variant="primary"
          icon={<Play size={18} />}
          disabled={ready === 0}
          onClick={() => navigate({ name: 'play', id })}
        >
          Play
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)_17rem]">
        <QuestionList
          questions={questions}
          selected={index}
          onSelect={setSelected}
          onAdd={(kind) => insert(createQuestion(kind), index + 1)}
        />
        <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <QuestionCard question={question} number={index + 1} onChange={setQuestion} />
          {/* On narrow screens the settings follow the card. */}
          <div className="mt-6 lg:hidden">
            <QuestionSettings
              question={question}
              onChange={setQuestion}
              canDelete={questions.length > 1}
              canMoveUp={index > 0}
              canMoveDown={index < questions.length - 1}
              onDuplicate={() => insert(duplicate(question), index + 1)}
              onDelete={() => remove(index)}
              onMove={(d) => move(index, d)}
            />
          </div>
        </main>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-surface-raised p-4 lg:block">
          <QuestionSettings
            question={question}
            onChange={setQuestion}
            canDelete={questions.length > 1}
            canMoveUp={index > 0}
            canMoveDown={index < questions.length - 1}
            onDuplicate={() => insert(duplicate(question), index + 1)}
            onDelete={() => remove(index)}
            onMove={(d) => move(index, d)}
          />
        </aside>
      </div>
    </div>
  )

  function remove(at: number) {
    if (questions.length <= 1 || !quiz) return
    const before = quiz
    update({ ...quiz, questions: questions.filter((_, i) => i !== at) })
    setSelected(Math.max(0, at - 1))
    showNotice(`Deleted question ${at + 1}.`, {
      label: 'Undo',
      run: () => {
        update(before)
        setSelected(at)
      },
    })
  }

  function move(at: number, direction: -1 | 1) {
    if (!quiz) return
    const to = at + direction
    if (to < 0 || to >= questions.length) return
    const list = [...questions]
    ;[list[at], list[to]] = [list[to]!, list[at]!]
    update({ ...quiz, questions: list })
    setSelected(to)
  }
}

function duplicate(q: QuizQuestion): QuizQuestion {
  return { ...q, id: newId(), answers: q.answers.map((a) => ({ ...a, id: newId() })) }
}

/** The questions as small cards; a tap edits one; "Add question" picks the kind. */
function QuestionList({
  questions,
  selected,
  onSelect,
  onAdd,
}: {
  questions: QuizQuestion[]
  selected: number
  onSelect: (index: number) => void
  onAdd: (kind: QuestionKind) => void
}) {
  const [adding, setAdding] = useState(false)
  return (
    <nav
      aria-label="Questions"
      className="flex min-h-0 flex-col border-r border-line bg-surface-raised"
    >
      <ol className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-3">
        {questions.map((q, i) => {
          const Icon = KIND_ICONS[q.kind]
          const problem = questionProblem(q)
          return (
            <li key={q.id}>
              <button
                type="button"
                aria-current={i === selected}
                onClick={() => onSelect(i)}
                className="grid w-full gap-1.5 rounded-card bg-surface p-2.5 text-left ring-1 ring-line hover:bg-hover aria-current:ring-2 aria-current:ring-accent"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                  {i + 1}
                  <Icon size={14} />
                  <span className="truncate">
                    {QUESTION_KINDS.find((k) => k.kind === q.kind)?.label}
                  </span>
                  {problem ? (
                    <span
                      title={problem}
                      aria-label="Not ready"
                      className="ml-auto size-2 shrink-0 rounded-full bg-incorrect"
                    />
                  ) : null}
                </span>
                <span className="line-clamp-2 text-sm font-semibold">
                  {q.text.trim() || <span className="text-ink-subtle">Empty question</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="border-t border-line p-3">
        <Popover open={adding} onOpenChange={setAdding}>
          <PopoverTrigger asChild>
            <Button variant="primary" icon={<Plus size={18} />} className="w-full">
              Add question
            </Button>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="grid w-72 gap-1 p-2">
            {QUESTION_KINDS.map(({ kind, label, hint }) => {
              const Icon = KIND_ICONS[kind]
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    onAdd(kind)
                  }}
                  className="flex items-center gap-3 rounded-control p-2.5 text-left hover:bg-hover"
                >
                  <Icon size={20} className="shrink-0 text-accent" />
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs text-ink-muted">{hint}</span>
                  </span>
                </button>
              )
            })}
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  )
}

/** The question as players see it, editable in place: text, picture and answers. */
function QuestionCard({
  question,
  number,
  onChange,
}: {
  question: QuizQuestion
  number: number
  onChange: (q: QuizQuestion) => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const problem = questionProblem(question)
  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <div className="grid gap-2">
        <label className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Question {number}
        </label>
        <QuestionSheet compact className="focus-within:ring-2 focus-within:ring-accent">
          <textarea
            aria-label="Question"
            placeholder="Write your question"
            value={question.text}
            maxLength={240}
            rows={2}
            onChange={(e) => onChange({ ...question, text: e.target.value })}
            className="block w-full resize-none bg-transparent text-2xl leading-8 font-bold placeholder:text-ink-subtle focus:outline-none"
          />
        </QuestionSheet>
      </div>

      <div className="grid place-items-center">
        {question.image ? (
          <div className="relative">
            <img
              src={question.image}
              alt=""
              className="max-h-56 rounded-card object-contain shadow-soft"
            />
            <IconButton
              label="Remove picture"
              icon={<X size={18} />}
              onClick={() => {
                const { image: _image, ...rest } = question
                onChange(rest)
              }}
              className="absolute top-2 right-2 bg-surface-raised/90 shadow-soft"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => file.current?.click()}
            className="flex h-28 w-full max-w-md flex-col items-center justify-center gap-1 rounded-card text-sm font-semibold text-ink-muted ring-2 ring-line ring-inset [border-style:dashed] hover:bg-hover"
          >
            <ImagePlus size={24} />
            Add a picture
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0]
            e.target.value = ''
            if (!picked) return
            pictureDataUrl(picked)
              .then((image) => onChange({ ...question, image }))
              .catch((err: unknown) => {
                console.error(err)
                showNotice('The picture could not be added.')
              })
          }}
        />
      </div>

      <Answers question={question} onChange={onChange} />

      {problem ? (
        <p className="text-center text-sm font-semibold text-incorrect">{problem}</p>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-correct">
          <Check size={16} /> Ready to play
        </p>
      )}
    </div>
  )
}

function Answers({
  question,
  onChange,
}: {
  question: QuizQuestion
  onChange: (q: QuizQuestion) => void
}) {
  const setText = (id: string, text: string) =>
    onChange({
      ...question,
      answers: question.answers.map((a) => (a.id === id ? { ...a, text } : a)),
    })
  const removeAnswer = (id: string) =>
    onChange({ ...question, answers: question.answers.filter((a) => a.id !== id) })
  const minimum = question.kind === 'order' ? 3 : question.kind === 'typed' ? 1 : 2
  const canAdd = question.kind !== 'truefalse' && question.answers.length < MAX_ANSWERS

  if (question.kind === 'slider') {
    return <SliderAnswer question={question} onChange={onChange} />
  }

  if (question.kind === 'typed') {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-2">
        <p className="text-sm font-semibold">Accepted answers</p>
        <p className="text-xs text-ink-muted">Capitals, accents and extra spaces do not matter.</p>
        {question.answers.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <input
              aria-label={`Accepted answer ${i + 1}`}
              placeholder={i === 0 ? 'The right answer' : 'Another way to write it'}
              value={a.text}
              maxLength={80}
              onChange={(e) => setText(a.id, e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-control bg-surface-raised px-3 text-base font-semibold ring-1 ring-line focus:ring-2 focus:ring-accent focus:outline-none"
            />
            {question.answers.length > minimum ? (
              <IconButton
                label={`Remove answer ${i + 1}`}
                icon={<Minus size={18} />}
                onClick={() => removeAnswer(a.id)}
              />
            ) : null}
          </div>
        ))}
        {canAdd ? (
          <Button
            icon={<Plus size={16} />}
            className="justify-self-start"
            onClick={() => onChange(addAnswer(question))}
          >
            Another spelling
          </Button>
        ) : null}
      </div>
    )
  }

  const order = question.kind === 'order'
  const pickCorrect = question.kind !== 'poll' && !order
  return (
    <div className="grid gap-3">
      {order ? (
        <p className="text-center text-sm text-ink-muted">
          Write the items in the right order; players get them shuffled.
        </p>
      ) : null}
      <div className={cn('grid gap-3', order ? 'grid-cols-1' : 'sm:grid-cols-2')}>
        {question.answers.map((a, i) => (
          <div key={a.id} className={answerCard(false, true)}>
            {order ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-sunken font-bold text-ink-muted">
                {i + 1}
              </span>
            ) : (
              <AnswerLetter index={i} state={a.correct && pickCorrect ? 'right' : 'idle'} />
            )}
            <input
              aria-label={`Answer ${i + 1}`}
              placeholder={`Answer ${i + 1}${i >= minimum ? ' (optional)' : ''}`}
              value={a.text}
              readOnly={question.kind === 'truefalse'}
              maxLength={90}
              onChange={(e) => setText(a.id, e.target.value)}
              className="h-11 min-w-0 flex-1 bg-transparent text-lg font-semibold placeholder:text-ink-subtle focus:outline-none"
            />
            {question.answers.length > minimum && question.kind !== 'truefalse' ? (
              <button
                type="button"
                aria-label={`Remove answer ${i + 1}`}
                onClick={() => removeAnswer(a.id)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-hover"
              >
                <Minus size={18} />
              </button>
            ) : null}
            {pickCorrect ? (
              <button
                type="button"
                role={question.kind === 'multiple' ? 'checkbox' : 'radio'}
                aria-checked={a.correct}
                aria-label={`Answer ${i + 1} is right`}
                onClick={() => onChange(toggleCorrect(question, a.id))}
                className={cn(
                  'flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold ring-1 transition-colors',
                  a.correct
                    ? 'bg-correct text-ink-inverse ring-correct'
                    : 'text-ink-muted ring-line hover:bg-hover',
                )}
              >
                <Check size={16} strokeWidth={3} />
                {a.correct ? 'Right' : 'Mark right'}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {canAdd ? (
        <Button
          icon={<Plus size={16} />}
          className="justify-self-center"
          onClick={() => onChange(addAnswer(question))}
        >
          {order ? 'Add item' : 'Add answer'}
        </Button>
      ) : null}
    </div>
  )
}

function SliderAnswer({
  question,
  onChange,
}: {
  question: QuizQuestion
  onChange: (q: QuizQuestion) => void
}) {
  const s = question.slider ?? {
    min: 0,
    max: 100,
    step: 1,
    correct: 50,
    tolerance: 0,
    unit: '',
  }
  const set = (patch: Partial<typeof s>) => onChange({ ...question, slider: { ...s, ...patch } })
  const number = (label: string, value: number, key: keyof typeof s) => (
    <NumberField label={label} value={value} onChange={(v) => set({ [key]: v })} />
  )
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-card bg-surface-raised p-5 shadow-soft ring-1 ring-line">
      <div className="grid gap-1">
        <input
          type="range"
          aria-label="Right value on the scale"
          min={s.min}
          max={s.max}
          step={s.step > 0 ? s.step : 1}
          value={s.correct}
          onChange={(e) => set({ correct: Number(e.target.value) })}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-sm text-ink-muted">
          <span>
            {s.min}
            {s.unit}
          </span>
          <span className="font-bold text-ink">
            Right: {s.correct}
            {s.unit}
          </span>
          <span>
            {s.max}
            {s.unit}
          </span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {number('Smallest', s.min, 'min')}
        {number('Largest', s.max, 'max')}
        {number('Step', s.step, 'step')}
        {number('Right value', s.correct, 'correct')}
        {number('Also right within ±', s.tolerance, 'tolerance')}
        <TextField
          label="Unit"
          placeholder="e.g. km, °C"
          value={s.unit}
          maxLength={8}
          onChange={(e) => set({ unit: e.target.value })}
        />
      </div>
    </div>
  )
}

/** A number field that can be cleared and retyped; it changes the value once it is a number. */
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  return (
    <TextField
      label={label}
      inputMode="decimal"
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value)
        const v = Number(e.target.value.replace(',', '.'))
        if (e.target.value.trim() !== '' && Number.isFinite(v)) onChange(v)
      }}
      onBlur={() => setText(null)}
    />
  )
}

/** The question's kind, time and points, and moving, duplicating or deleting it. */
function QuestionSettings({
  question,
  onChange,
  canDelete,
  canMoveUp,
  canMoveDown,
  onDuplicate,
  onDelete,
  onMove,
}: {
  question: QuizQuestion
  onChange: (q: QuizQuestion) => void
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onDuplicate: () => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <section className="grid grid-cols-1 gap-2">
        <h3 className="text-sm font-semibold">Question type</h3>
        <div role="radiogroup" aria-label="Question type" className="grid grid-cols-1 gap-1">
          {QUESTION_KINDS.map(({ kind, label, hint }) => {
            const Icon = KIND_ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={question.kind === kind}
                onClick={() => onChange(changeKind(question, kind))}
                className="flex items-center gap-2.5 rounded-control p-2 text-left ring-1 ring-transparent hover:bg-hover aria-checked:bg-surface-sunken aria-checked:ring-accent"
              >
                <Icon size={18} className="shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block truncate text-xs text-ink-muted">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <h3 className="text-sm font-semibold">Time limit</h3>
        <div role="radiogroup" aria-label="Time limit" className="flex flex-wrap gap-1.5">
          {TIME_LIMITS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={question.time === t}
              onClick={() => onChange({ ...question, time: t })}
              className="h-9 min-w-12 rounded-full px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-checked:bg-ink aria-checked:text-ink-inverse aria-checked:ring-ink"
            >
              {t < 60 ? `${t} s` : `${t / 60} min`}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <h3 className="text-sm font-semibold">Points</h3>
        <div role="radiogroup" aria-label="Points" className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['standard', 'Normal'],
              ['double', '× 2'],
              ['none', 'For fun'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={question.points === value}
              disabled={question.kind === 'poll'}
              onClick={() => onChange({ ...question, points: value })}
              className="h-10 rounded-control text-sm font-semibold ring-1 ring-line hover:bg-hover disabled:opacity-40 aria-checked:bg-ink aria-checked:text-ink-inverse aria-checked:ring-ink"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          {question.kind === 'poll'
            ? 'An opinion has no right answer, so it gives no points.'
            : `${POINTS_RIGHT} points for a right answer, up to ${POINTS_QUICK} more for a quick one.`}
        </p>
      </section>

      <section className="grid gap-1 border-t border-line pt-4">
        <Button
          variant="ghost"
          className="justify-start"
          icon={<ChevronUp size={18} />}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          Move up
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          icon={<ChevronDown size={18} />}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          Move down
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          icon={<Copy size={18} />}
          onClick={onDuplicate}
        >
          Duplicate
        </Button>
        <Button
          variant="ghost"
          className="justify-start text-danger"
          icon={<Trash2 size={18} />}
          disabled={!canDelete}
          onClick={onDelete}
        >
          Delete question
        </Button>
      </section>
    </div>
  )
}
