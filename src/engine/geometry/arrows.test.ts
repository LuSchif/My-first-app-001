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
    expect(arrow).not.toBeNull()
    // The corner stays a corner.
    const corner = arrow!.shaft.findIndex(
      (_, i) => i % 2 === 0 && Math.hypot(arrow!.shaft[i]! - 250, arrow!.shaft[i + 1]! - 95) < 4,
    )
    expect(corner).toBeGreaterThan(0)
    // Pointing down.
    expect(arrow!.head[1]!).toBeLessThan(arrow!.head[3]!)
  })

  it('finds small arrows', () => {
    const shaft = { id: 'a', points: line(100, 100, 114, 92, 10) }
    const head = {
      id: 'b',
      points: [...line(108, 91, 115, 92, 5), ...line(115, 92, 112, 98, 5)],
    }
    expect(detectArrow([shaft, head])).not.toBeNull()
  })

  it('smooths a curved shaft and keeps its size', () => {
    const curve = Array.from({ length: 41 }, (_, i) => [
      100 + i * 5 + rnd() * 2,
      200 - Math.sin((i / 40) * Math.PI) * 60 + rnd() * 2,
    ]).flat()
    const head = {
      id: 'b',
      points: [...line(281, 195, 300, 200, 8), ...line(300, 200, 295, 181, 8)],
    }
    const arrow = detectArrow([{ id: 'a', points: curve }, head])
    expect(arrow).not.toBeNull()
    const ys = arrow!.shaft.filter((_, i) => i % 2 === 1)
    // Still as tall as drawn.
    expect(Math.min(...ys)).toBeLessThan(145)
    // No wobble: the height changes direction once.
    let turns = 0
    for (let i = 2; i < ys.length; i++) {
      if ((ys[i]! - ys[i - 1]!) * (ys[i - 1]! - ys[i - 2]!) < -1e-9) turns++
    }
    expect(turns).toBeLessThanOrEqual(1)
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
