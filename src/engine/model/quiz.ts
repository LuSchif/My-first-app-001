import { newId } from './ids.ts'
import type { Id } from './types.ts'

/**
 * Quizzes, in the spirit of Kahoot: questions with a time limit, answered on colored tiles;
 * the faster a right answer, the more points.
 */

export type QuestionKind =
  'single' | 'multiple' | 'truefalse' | 'order' | 'typed' | 'slider' | 'poll'

export interface QuizAnswer {
  id: Id
  text: string
  /** Right answer (single, multiple, true/false), or an accepted spelling (typed). */
  correct: boolean
}

export interface SliderRange {
  min: number
  max: number
  step: number
  /** The right value. */
  correct: number
  /** Answers this close to the right value count as right too. */
  tolerance: number
  unit: string
}

export interface QuizQuestion {
  id: Id
  kind: QuestionKind
  text: string
  /** A picture shown with the question, as a small JPEG data URL. */
  image?: string
  /** Choices; for `order` in the right order; for `typed` the accepted answers. */
  answers: QuizAnswer[]
  slider?: SliderRange
  /** Seconds to answer. */
  time: number
  points: 'standard' | 'double' | 'none'
}

export interface QuizResult {
  at: number
  score: number
  /** Questions answered right, of those that have a right answer. */
  correct: number
  total: number
}

export interface QuizData {
  questions: QuizQuestion[]
  /** The owner's own runs, newest first (at most RESULTS_KEPT). */
  results?: QuizResult[]
}

export const QUESTION_KINDS: { kind: QuestionKind; label: string; hint: string }[] = [
  { kind: 'single', label: 'Quiz', hint: 'One right answer of up to six' },
  { kind: 'multiple', label: 'Multi-select', hint: 'Several right answers' },
  { kind: 'truefalse', label: 'True or false', hint: 'Is the statement true?' },
  { kind: 'order', label: 'Puzzle', hint: 'Put the answers in the right order' },
  { kind: 'typed', label: 'Type answer', hint: 'Players type the answer' },
  { kind: 'slider', label: 'Slider', hint: 'Pick a number on a scale' },
  { kind: 'poll', label: 'Poll', hint: 'Ask for opinions; no right answer' },
]

export const TIME_LIMITS = [5, 10, 20, 30, 45, 60, 90, 120, 240]
export const MAX_ANSWERS = 6
export const RESULTS_KEPT = 20

function answer(text = '', correct = false): QuizAnswer {
  return { id: newId(), text, correct }
}

/** A new question of a kind, with empty answers ready to fill in. */
export function createQuestion(kind: QuestionKind = 'single'): QuizQuestion {
  return { id: newId(), kind, text: '', time: 20, points: 'standard', ...answersFor(kind, []) }
}

/** The answers (and slider) a question gets as `kind`, keeping what fits from `old`. */
function answersFor(
  kind: QuestionKind,
  old: QuizAnswer[],
): Pick<QuizQuestion, 'answers' | 'slider'> {
  const texts = old.map((a) => a.text)
  const fill = (n: number) =>
    Array.from({ length: Math.max(n, Math.min(old.length, MAX_ANSWERS)) }, (_, i) =>
      answer(texts[i] ?? '', false),
    )
  switch (kind) {
    case 'truefalse':
      return { answers: [answer('True', true), answer('False', false)] }
    case 'typed':
      return { answers: [answer(texts.find((t) => t.trim()) ?? '', true)] }
    case 'slider':
      return {
        answers: [],
        slider: { min: 0, max: 100, step: 1, correct: 50, tolerance: 0, unit: '' },
      }
    case 'order':
      return { answers: fill(4).slice(0, Math.max(3, Math.min(old.length || 4, MAX_ANSWERS))) }
    case 'single': {
      const answers = fill(4)
      const right = old.findIndex((a) => a.correct)
      if (right >= 0 && answers[right]) answers[right] = { ...answers[right], correct: true }
      return { answers }
    }
    case 'multiple':
      return {
        answers: fill(4).map((a, i) => ({ ...a, correct: Boolean(old[i]?.correct) })),
      }
    case 'poll':
      return { answers: fill(4) }
  }
}

/** The question as another kind; its text, picture, time and points stay. */
export function changeKind(question: QuizQuestion, kind: QuestionKind): QuizQuestion {
  if (question.kind === kind) return question
  const { slider: _slider, ...rest } = question
  return { ...rest, kind, ...answersFor(kind, question.answers) }
}

export function addAnswer(question: QuizQuestion): QuizQuestion {
  if (question.answers.length >= MAX_ANSWERS) return question
  return { ...question, answers: [...question.answers, answer('', question.kind === 'typed')] }
}

/** Marks an answer right (only one for `single`), or unmarks it. */
export function toggleCorrect(question: QuizQuestion, id: Id): QuizQuestion {
  const one = question.kind === 'single' || question.kind === 'truefalse'
  return {
    ...question,
    answers: question.answers.map((a) =>
      a.id === id ? { ...a, correct: one ? true : !a.correct } : one ? { ...a, correct: false } : a,
    ),
  }
}

/** What still keeps a question from being played, or null when it is ready. */
export function questionProblem(q: QuizQuestion): string | null {
  if (!q.text.trim()) return 'Write the question.'
  const filled = q.answers.filter((a) => a.text.trim())
  switch (q.kind) {
    case 'single':
    case 'multiple':
    case 'poll':
      if (filled.length < 2) return 'Give at least two answers.'
      if (q.kind !== 'poll' && !filled.some((a) => a.correct)) return 'Mark the right answer.'
      return null
    case 'truefalse':
      return q.answers.some((a) => a.correct) ? null : 'Choose true or false.'
    case 'order':
      return filled.length < 3 ? 'Give at least three items to put in order.' : null
    case 'typed':
      return filled.length ? null : 'Write the right answer.'
    case 'slider': {
      const s = q.slider
      if (!s || !(s.max > s.min)) return 'The largest value must be above the smallest.'
      if (s.correct < s.min || s.correct > s.max) return 'The right value must be on the scale.'
      return null
    }
  }
}

/** The questions that can be played: written, with their answers in place. */
export function playable(quiz: QuizData): QuizQuestion[] {
  return quiz.questions.filter((q) => questionProblem(q) === null)
}

/** What a player gave as an answer. */
export type Response =
  | { kind: 'choice'; ids: Id[] }
  | { kind: 'order'; ids: Id[] }
  | { kind: 'text'; text: string }
  | { kind: 'number'; value: number }
  | { kind: 'none' }

function normalize(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

/** Whether a response is right; null for a poll, which has no right answer. */
export function isCorrect(q: QuizQuestion, response: Response): boolean | null {
  if (q.kind === 'poll') return null
  const answers = q.answers.filter((a) => a.text.trim())
  switch (response.kind) {
    case 'none':
      return false
    case 'choice': {
      const right = new Set(answers.filter((a) => a.correct).map((a) => a.id))
      return response.ids.length === right.size && response.ids.every((id) => right.has(id))
    }
    case 'order':
      return (
        response.ids.length === answers.length && answers.every((a, i) => a.id === response.ids[i])
      )
    case 'text':
      return answers.some((a) => normalize(a.text) === normalize(response.text))
    case 'number': {
      const s = q.slider
      return Boolean(s) && Math.abs(response.value - s!.correct) <= s!.tolerance + 1e-9
    }
  }
}

/**
 * Points for an answer, as in Kahoot: a right answer is worth up to 1000 points, falling to
 * 500 as the time runs out; double points double that; no points, none.
 */
export function pointsFor(q: QuizQuestion, response: Response, secondsUsed: number): number {
  if (q.points === 'none' || isCorrect(q, response) !== true) return 0
  const share = Math.min(1, Math.max(0, secondsUsed / q.time))
  const points = Math.round(1000 * (1 - share / 2))
  return q.points === 'double' ? points * 2 : points
}

/** The answers of an `order` question shuffled for playing, never in the right order. */
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const out = [...items]
  if (out.length < 2) return out
  do {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[out[i], out[j]] = [out[j]!, out[i]!]
    }
  } while (out.every((item, i) => item === items[i]))
  return out
}

export function createQuiz(): QuizData {
  return { questions: [createQuestion('single')] }
}
