import { describe, expect, it } from 'vitest'
import {
  changeKind,
  createQuestion,
  isCorrect,
  pointsFor,
  questionProblem,
  shuffled,
  toggleCorrect,
  type QuizQuestion,
} from './quiz.ts'

function filled(kind: QuizQuestion['kind'], texts = ['Paris', 'Rome', 'Berlin', 'Madrid']) {
  const q = createQuestion(kind)
  return {
    ...q,
    text: 'Capital of France?',
    answers: q.answers.map((a, i) => ({ ...a, text: texts[i] ?? a.text })),
  }
}

describe('quiz questions', () => {
  it('needs a right answer before it can be played', () => {
    const q = filled('single')
    expect(questionProblem(q)).toBe('Mark the right answer.')
    expect(questionProblem(toggleCorrect(q, q.answers[0]!.id))).toBeNull()
  })

  it('keeps a single right answer for single choice', () => {
    let q = filled('single')
    q = toggleCorrect(q, q.answers[0]!.id)
    q = toggleCorrect(q, q.answers[1]!.id)
    expect(q.answers.filter((a) => a.correct).map((a) => a.text)).toEqual(['Rome'])
  })

  it('checks the whole set for multi-select', () => {
    let q = filled('multiple')
    q = toggleCorrect(toggleCorrect(q, q.answers[0]!.id), q.answers[2]!.id)
    const [a, , c] = q.answers
    expect(isCorrect(q, { kind: 'choice', ids: [c!.id, a!.id] })).toBe(true)
    expect(isCorrect(q, { kind: 'choice', ids: [a!.id] })).toBe(false)
  })

  it('checks order and typed answers', () => {
    const order = filled('order', ['one', 'two', 'three'])
    // Empty items are left out when playing.
    const items = order.answers.filter((a) => a.text)
    expect(isCorrect(order, { kind: 'order', ids: items.map((a) => a.id) })).toBe(true)
    expect(isCorrect(order, { kind: 'order', ids: [...items].reverse().map((a) => a.id) })).toBe(
      false,
    )
    const typed = { ...createQuestion('typed'), text: 'Q' }
    typed.answers = [{ ...typed.answers[0]!, text: 'Café' }]
    expect(isCorrect(typed, { kind: 'text', text: '  cafe ' })).toBe(true)
  })

  it('accepts slider values within the tolerance', () => {
    const q = createQuestion('slider')
    q.slider = { ...q.slider!, correct: 40, tolerance: 2 }
    expect(isCorrect(q, { kind: 'number', value: 42 })).toBe(true)
    expect(isCorrect(q, { kind: 'number', value: 43 })).toBe(false)
  })

  it('gives more points for faster right answers', () => {
    const base = filled('single')
    const q = toggleCorrect(base, base.answers[0]!.id)
    const right = { kind: 'choice' as const, ids: [q.answers.find((a) => a.correct)!.id] }
    expect(pointsFor(q, right, 0)).toBe(1000)
    expect(pointsFor(q, right, q.time)).toBe(500)
    expect(pointsFor({ ...q, points: 'double' }, right, 0)).toBe(2000)
    expect(pointsFor(q, { kind: 'none' }, 1)).toBe(0)
  })

  it('keeps the text when the kind changes', () => {
    const q = changeKind(filled('single'), 'truefalse')
    expect(q.text).toBe('Capital of France?')
    expect(q.answers.map((a) => a.text)).toEqual(['True', 'False'])
  })

  it('never shuffles into the right order', () => {
    const items = [1, 2, 3]
    let n = 0
    const random = () => [0.99, 0.99, 0.2, 0.6][n++ % 4]!
    expect(shuffled(items, random)).not.toEqual(items)
  })
})
