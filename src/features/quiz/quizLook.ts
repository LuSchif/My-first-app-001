import { cn } from '../../lib/cn.ts'
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

/** The classes of an answer card (a button or a row). */
export function answerCard(chosen = false, compact = false): string {
  return cn(
    'flex items-center rounded-card bg-surface-raised px-4 text-left text-lg font-semibold text-ink shadow-soft transition-[transform,box-shadow]',
    compact ? 'min-h-16 gap-3 py-2' : 'min-h-20 gap-4 py-3',
    chosen ? 'ring-2 ring-selected' : 'ring-1 ring-line',
  )
}
