import { describe, expect, it } from 'vitest'
import { fitAfter, gestureDistance, matchesGesture } from './gesture.ts'
import type { GestureSettings } from './types.ts'

/** A bracket opening to the right (left = true) or to the left, from (x, y) down `h`. */
function bracket(x: number, y: number, h: number, left: boolean, wobble = 0): number[] {
  const out: number[] = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const bow = Math.sin(t * Math.PI) * h * 0.18
    out.push(x + (left ? -bow : bow) + Math.sin(i * 1.7) * wobble, y + t * h)
  }
  return out
}

function circle(cx: number, cy: number, r: number): number[] {
  const out: number[] = []
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 2
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  return out
}

const settings: GestureSettings = {
  before: [
    { tool: 'pen', color: '#000', width: 2, points: bracket(20, 10, 40, true) },
    { tool: 'pen', color: '#000', width: 2, points: bracket(80, 10, 40, false) },
  ],
  after: [{ tool: 'highlighter', color: '#ff0', width: 30, points: [20, 30, 80, 30] }],
  keepBefore: false,
  tolerance: 0.5,
}

describe('gestures', () => {
  it('recognizes brackets drawn far apart, in any order, with a shaky hand', () => {
    const wide = [bracket(500, 200, 30, false, 1), bracket(100, 205, 28, true, 1)]
    expect(matchesGesture(wide, settings)).toBe(true)
  })

  it('does not take other drawings for it', () => {
    expect(matchesGesture([circle(100, 100, 20), circle(200, 100, 20)], settings)).toBe(false)
    expect(matchesGesture([bracket(100, 100, 30, true)], settings)).toBe(false)
    const same = [bracket(100, 100, 30, true), bracket(200, 100, 30, true)]
    expect(
      gestureDistance(
        same,
        settings.before.map((s) => s.points),
      ),
    ).toBeGreaterThan(
      gestureDistance(
        [bracket(100, 100, 30, true), bracket(200, 100, 30, false)],
        settings.before.map((s) => s.points),
      ),
    )
  })

  it('fits the result to where the drawing was made', () => {
    const [mark] = fitAfter(settings, { minX: 100, minY: 200, maxX: 500, maxY: 230 })
    // Between the brackets, in the middle.
    expect(mark!.points[0]).toBeGreaterThan(100)
    expect(mark!.points[2]).toBeLessThan(500)
    expect((mark!.points[0]! + mark!.points[2]!) / 2).toBeCloseTo(300, 0)
    expect(mark!.points[1]).toBeCloseTo(215, 0)
    // As tall as the brackets, relative to how it was drawn.
    expect(mark!.width).toBeCloseTo(30 * (30 / 40), 0)
  })
})

describe('one-stroke commands', () => {
  it('need the same proportions, not just the same kind of curve', () => {
    const loop = (w: number, h: number) => {
      const out: number[] = []
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * Math.PI * 2
        out.push(Math.cos(a) * w, Math.sin(a) * h)
      }
      return out
    }
    const s: GestureSettings = {
      before: [{ tool: 'pen', color: '#000', width: 2, points: loop(40, 40) }],
      after: [{ tool: 'pen', color: '#000', width: 2, points: [0, 0, 1, 1] }],
      keepBefore: false,
      tolerance: 0.5,
    }
    expect(matchesGesture([loop(60, 55)], s)).toBe(true)
    expect(matchesGesture([loop(120, 20)], s)).toBe(false)
  })
})
