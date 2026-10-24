import { describe, expect, it } from 'vitest'
import { toWords } from './textHighlight.ts'

describe('text highlight', () => {
  const text = 'Highlight these words please'
  it('marks a word more than half covered as a whole', () => {
    // "these wor" → "these words"
    expect(toWords(text, 10, 19)).toEqual({ start: 10, end: 21 })
  })
  it('leaves out a word barely touched', () => {
    // "ht these w" → "these"
    expect(toWords(text, 7, 17)).toEqual({ start: 10, end: 15 })
  })
  it('never marks spaces at the edges', () => {
    expect(toWords(text, 9, 16)).toEqual({ start: 10, end: 15 })
  })
})
