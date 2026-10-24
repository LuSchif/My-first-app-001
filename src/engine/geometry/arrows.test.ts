import { describe, expect, it } from 'vitest'
import { detectArrow } from './arrows.ts'

let seed = 5
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2
const line = (x0: number, y0: number, x1: number, y1: number, n = 30) =>
  Array.from({ length: n + 1 }, (_, i) => [
    x0 + ((x1 - x0) * i) / n + rnd() * 0.6,
    y0 + ((y1 - y0) * i) / n + rnd() * 0.6,
  ]).flat()

describe('arrow recognition', () => {
  it('finds a straight arrow with a separate head', () => {
    const shaft = { id: 'a', points: line(100, 200, 300, 200) }
    const head = {
      id: 'b',
      points: [...line(275, 180, 301, 200, 10), ...line(301, 200, 276, 222, 10)],
    }
    const arrow = detectArrow([shaft, head])
    expect(arrow?.straight).toBe(true)
    expect(arrow?.ids).toEqual(['a', 'b'])
    // The head points right.
    expect(arrow!.head[2]!).toBeGreaterThan(arrow!.head[0]!)
  })

  it('finds an arrow drawn in one stroke', () => {
    const points = [
      ...line(100, 100, 250, 160),
      ...line(250, 160, 222, 162, 8),
      ...line(222, 162, 250, 160, 8),
      ...line(250, 160, 235, 136, 8),
    ]
    expect(detectArrow([{ id: 'a', points }])).not.toBeNull()
  })

  it('keeps a bent shaft', () => {
    const shaft = { id: 'a', points: [...line(100, 100, 250, 95), ...line(250, 95, 262, 180)] }
    const head = {
      id: 'b',
      points: [...line(240, 160, 262, 182, 8), ...line(262, 182, 282, 158, 8)],
    }
    const arrow = detectArrow([shaft, head])
    expect(arrow?.straight).toBe(false)
    // Pointing down.
    expect(arrow!.head[1]!).toBeLessThan(arrow!.head[3]!)
  })

  it('ignores lines, angles and letters', () => {
    expect(detectArrow([{ id: 'a', points: line(100, 100, 300, 100) }])).toBeNull()
    const v = [...line(100, 100, 150, 200), ...line(150, 200, 200, 100)]
    expect(detectArrow([{ id: 'a', points: v }])).toBeNull()
    const k = [
      { id: 'a', points: line(100, 100, 100, 200) },
      { id: 'b', points: [...line(150, 100, 102, 150), ...line(102, 150, 150, 200)] },
    ]
    expect(detectArrow(k)).toBeNull()
  })
})
