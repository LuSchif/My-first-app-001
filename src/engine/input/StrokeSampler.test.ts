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

  it('keeps every sample when many share one time stamp', () => {
    const s = new StrokeSampler()
    for (let i = 0; i < 20; i++) s.add(i * 5, 0, 100)
    // The smoothing may merge the very first samples, but none is rejected as late.
    expect(s.points.length).toBeGreaterThan(15)
    expect(s.points.at(-1)!.x).toBeGreaterThan(80)
  })

  it('ignores sub-pixel jitter and tiny reversals', () => {
    const s = new StrokeSampler()
    // Samples a second apart let the smoothing settle, so positions are taken as given.
    s.add(0, 0, 0)
    s.add(10, 0, 1000)
    s.add(20, 0, 2000)
    expect(s.add(20.2, 0, 3000)).toBe(false) // under a pixel
    expect(s.add(18, 0, 4000)).toBe(false) // 2 px backwards
    expect(s.add(30, 0, 5000)).toBe(true)
  })

  it('ends the stroke at the pen tip', () => {
    const s = new StrokeSampler()
    for (let i = 0; i <= 10; i++) s.add(i * 20, 0, i * 4)
    const end = s.finalPoints().at(-1)!
    expect(end.x).toBe(200)
  })

  it('predicts ahead in the direction of travel', () => {
    const s = new StrokeSampler()
    for (let i = 0; i <= 10; i++) s.add(i * 4, 0, i * 4) // 1 px per ms to the right
    const p = s.predict(10)!
    expect(p.x).toBeGreaterThan(40)
    expect(p.y).toBeCloseTo(0)
  })
})
