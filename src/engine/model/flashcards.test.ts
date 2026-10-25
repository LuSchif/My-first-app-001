import { describe, expect, it } from 'vitest'
import { answer, BOX_DAYS, cardsOf, isDue, studyQueue } from './flashcards.ts'

const DAY = 86400000

describe('flashcards', () => {
  it('pairs pages into cards', () => {
    expect(cardsOf(['a', 'A', 'b', 'B'])).toEqual([
      { index: 0, front: 'a', back: 'A' },
      { index: 1, front: 'b', back: 'B' },
    ])
    expect(cardsOf(['a'])).toEqual([{ index: 0, front: 'a', back: 'a' }])
  })

  it('moves a known card up and a missed one back to the start', () => {
    const first = answer(undefined, true, 0)
    expect(first).toEqual({ box: 1, due: BOX_DAYS[1] * DAY, reviews: 1 })
    const second = answer(first, true, DAY)
    expect(second.box).toBe(2)
    expect(second.due).toBe(DAY + BOX_DAYS[2] * DAY)
    const missed = answer(second, false, 5 * DAY)
    expect(missed).toEqual({ box: 0, due: 5 * DAY, reviews: 3 })
    expect(answer({ box: 6, due: 0, reviews: 9 }, true, 0).box).toBe(6)
  })

  it('studies overdue cards first, then new ones', () => {
    const cards = cardsOf(['a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'])
    const study = {
      a: { box: 2, due: 5 * DAY, reviews: 2 },
      b: { box: 1, due: 2 * DAY, reviews: 1 },
      c: { box: 3, due: 20 * DAY, reviews: 3 },
    }
    const now = 10 * DAY
    expect(studyQueue(cards, study, now).map((c) => c.front)).toEqual(['b', 'a', 'd'])
    expect(studyQueue(cards, study, now, true)).toHaveLength(4)
    expect(isDue(study.c, now)).toBe(false)
  })
})
