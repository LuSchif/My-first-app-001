import { Pencil, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { navigate } from '../../app/router.ts'
import { Button } from '../../design/index.ts'
import {
  isCorrect,
  playable,
  pointsFor,
  RESULTS_KEPT,
  type QuizQuestion,
  type QuizResult,
} from '../../engine/model/quiz.ts'
import type { Notebook } from '../../engine/model/types.ts'
import { loadNotebook, saveQuiz } from '../../storage/notebooks.ts'
import { Asking, PlayScreen, QuestionHeading, Verdict, type Answered } from './playParts.tsx'
import { QuizIntro, QuizSummary } from './QuizSummary.tsx'

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
  const exit = () => navigate({ name: 'library' })
  if (!notebook || notebook.kind !== 'quiz' || questions.length === 0) {
    return (
      <PlayScreen onExit={exit}>
        <p className="text-xl font-bold">This quiz has no questions ready to play.</p>
        <Button onClick={() => navigate(notebook ? { name: 'quiz', id } : { name: 'library' })}>
          {notebook ? 'Edit the quiz' : 'Back to the library'}
        </Button>
      </PlayScreen>
    )
  }

  const question = questions[index]!
  const results = notebook.quiz?.results ?? []

  if (phase === 'intro') {
    return (
      <PlayScreen onExit={exit}>
        <QuizIntro
          title={notebook.title}
          cover={notebook.cover}
          count={questions.length}
          best={results.length ? Math.max(...results.map((r) => r.score)) : null}
        >
          <Button
            variant="primary"
            size="lg"
            className="min-w-40"
            onClick={() => setPhase('question')}
          >
            Start
          </Button>
        </QuizIntro>
      </PlayScreen>
    )
  }

  if (phase === 'done') {
    return (
      <PlayScreen onExit={exit}>
        <QuizSummary questions={questions} answers={answers}>
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
        </QuizSummary>
      </PlayScreen>
    )
  }

  const answered = answers[index]
  const last = index + 1 === questions.length
  const next = () => {
    if (!last) {
      setIndex(index + 1)
      setPhase('question')
      return
    }
    setPhase('done')
    void storeResult(notebook, questions, answers).then(setNotebook)
  }

  return (
    <PlayScreen
      onExit={exit}
      top={
        <>
          <span>
            Question {index + 1} of {questions.length}
          </span>
          <span className="tabular-nums">{score} points</span>
        </>
      }
    >
      <QuestionHeading question={question} />
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
        <>
          <Verdict question={question} answered={answered} />
          <Button variant="primary" size="lg" className="min-w-40" onClick={next}>
            {last ? 'See results' : 'Next question'}
          </Button>
        </>
      ) : null}
    </PlayScreen>
  )
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
