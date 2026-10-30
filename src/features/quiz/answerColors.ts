import {
  ArrowDownUp,
  CheckSquare,
  CircleDot,
  Keyboard,
  SlidersHorizontal,
  ToggleLeft,
  Vote,
} from 'lucide-react'
import type { QuestionKind } from '../../engine/model/quiz.ts'

/** Each answer's color (design tokens) and shape, by its place, as in Kahoot. */
export const ANSWER_COLORS = [
  'var(--color-answer-1)',
  'var(--color-answer-2)',
  'var(--color-answer-3)',
  'var(--color-answer-4)',
  'var(--color-answer-5)',
  'var(--color-answer-6)',
]

export function answerColor(index: number): string {
  return ANSWER_COLORS[index % ANSWER_COLORS.length]!
}

export const KIND_ICONS: Record<QuestionKind, typeof CircleDot> = {
  single: CircleDot,
  multiple: CheckSquare,
  truefalse: ToggleLeft,
  order: ArrowDownUp,
  typed: Keyboard,
  slider: SlidersHorizontal,
  poll: Vote,
}

/** The colors a quiz can have. */
export const QUIZ_COLORS = [
  ['Berry', '#7d3a5b'],
  ['Ocean', '#3b6fc9'],
  ['Forest', '#3f8f3a'],
  ['Sunset', '#d4703a'],
  ['Violet', '#6a4c93'],
  ['Mocha', '#795a46'],
] as const
