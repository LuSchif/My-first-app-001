import { describe, expect, it } from 'vitest'
import { StrokeSampler } from './StrokeSampler.ts'

describe('StrokeSampler', () => {
  it('drops late samples', () => {
    const s = new StrokeSampler()
    s.add(0, 0, 100)
    s.add(10, 0, 110)
    expect(s.add(5, 0, 105)).toBe(false)
    expect(s.filtered).toBe(1)
  })

  it('keeps every sample when many share one time stamp, spaced in time', () => {
    const s = new StrokeSampler()
    for (let i = 0; i < 20; i++) s.add(i * 5, 0, 100)
    expect(s.points).toHaveLength(20)
    const times = s.points.map((p) => p.t)
    expect(new Set(times).size).toBe(20)
  })

  it('evens out wobbles by pulling each point halfway towards the pen', () => {
    const s = new StrokeSampler()
    s.add(0, 0, 0)
    s.add(4, 2, 4)
    s.add(8, 0, 8)
    expect(s.points.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [2, 1],
      [5, 0.5],
    ])
    // The pen tip itself is never behind.
    expect(s.tip).toMatchObject({ x: 8, y: 0 })
  })

  it('ignores sub-pixel steps but keeps small turns of tiny letters', () => {
    const s = new StrokeSampler()
    s.add(10, 10, 0)
    expect(s.add(10.6, 10, 4)).toBe(false)
    expect(s.add(14, 10, 8)).toBe(true)
    expect(s.add(11, 11.5, 12)).toBe(true) // a small turn back is real handwriting
  })

  it('ends the stroke at the pen tip', () => {
    const s = new StrokeSampler()
    s.add(0, 0, 0)
    s.add(10, 0, 4)
    s.add(10.3, 0, 8) // too close to keep as a point, but it is where the pen lifted
    expect(s.finalPoints().at(-1)!.x).toBe(10.3)
  })
})
