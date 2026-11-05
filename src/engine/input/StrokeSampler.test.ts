import { describe, expect, it } from 'vitest'
import { DEFAULT_STABILIZATION, StrokeSampler } from './StrokeSampler.ts'

describe('StrokeSampler', () => {
  it('drops late samples', () => {
    const s = new StrokeSampler(0)
    s.add(0, 0, 100)
    s.add(10, 0, 110)
    expect(s.add(5, 0, 105)).toBe(false)
    expect(s.filtered).toBe(1)
  })

  it('keeps every sample when many share one time stamp, spaced in time', () => {
    const s = new StrokeSampler(0)
    for (let i = 0; i < 20; i++) s.add(i * 5, 0, 100)
    expect(s.points).toHaveLength(20)
    const times = s.points.map((p) => p.t)
    expect(new Set(times).size).toBe(20)
  })

  it('smooths a slow wobble strongly but follows a fast line closely', () => {
    const slow = new StrokeSampler()
    // 100 px/s along x with a ±1 px zigzag from the hand and sensor.
    for (let i = 0; i <= 60; i++) slow.add(i * 0.4, i % 2 ? 1 : -1, i * 4)
    const ys = slow.points.slice(10).map((p) => Math.abs(p.y))
    expect(Math.max(...ys)).toBeLessThan(0.6)

    const fast = new StrokeSampler()
    // 2000 px/s, straight.
    for (let i = 0; i <= 30; i++) fast.add(i * 8, 0, i * 4)
    expect(240 - fast.points.at(-1)!.x).toBeLessThan(24)
    // The pen tip itself is never behind.
    expect(fast.tip).toMatchObject({ x: 240, y: 0 })
  })

  it('takes out more tremor the stronger the stabilization', () => {
    const wobble = (stabilization: number) => {
      const s = new StrokeSampler(stabilization)
      // A slow hand (60 px/s) on whole-pixel coordinates, with a 1 px tremor.
      for (let i = 0; i <= 600; i++) s.add(Math.round(i * 0.25), i % 3 === 0 ? 1 : 0, i * 4)
      const ys = s.points.filter((p) => p.x > 100).map((p) => p.y)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(wobble(1)).toBeLessThan(wobble(0.5))
    expect(wobble(0.5)).toBeLessThan(wobble(0))
    expect(wobble(DEFAULT_STABILIZATION)).toBeLessThan(0.15)
  })

  it('guesses where the pen goes, less around a turn', () => {
    const s = new StrokeSampler()
    for (let i = 0; i <= 10; i++) s.add(i * 4, 0, i * 4)
    const ahead = s.predict(10, 20)!
    expect(ahead.x).toBeGreaterThan(45)
    expect(ahead.y).toBeCloseTo(0)
    expect(s.predict(10, 4)!.x).toBeCloseTo(44)

    const turn = new StrokeSampler()
    for (let i = 0; i <= 5; i++) turn.add(i * 4, 0, i * 4)
    turn.add(20, 4, 24)
    const guess = turn.predict(10, 20)!
    // Less far than the 10 px it would go straight on.
    expect(Math.hypot(guess.x - 20, guess.y - 4)).toBeLessThan(8)
  })

  it('ignores sub-pixel steps but keeps small turns of tiny letters', () => {
    const s = new StrokeSampler(0)
    s.add(10, 10, 0)
    expect(s.add(10.6, 10, 4)).toBe(false)
    expect(s.add(14, 10, 8)).toBe(true)
    // A small turn back is real handwriting: it shows within a sample or two.
    s.add(11, 11.5, 12)
    s.add(10.5, 12, 16)
    const end = s.points.at(-1)!
    expect(end.x).toBeLessThan(11.5)
    expect(end.y).toBeGreaterThan(10.5)
  })

  it('ends the stroke at the pen tip', () => {
    const s = new StrokeSampler()
    s.add(0, 0, 0)
    s.add(10, 0, 4)
    s.add(10.3, 0, 8) // too close to keep as a point, but it is where the pen lifted
    expect(s.finalPoints().at(-1)!.x).toBe(10.3)
  })
})
