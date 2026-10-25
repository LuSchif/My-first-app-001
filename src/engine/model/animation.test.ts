import { describe, expect, it } from 'vitest'
import { slideSteps, stepLength } from './animation.ts'
import type { CanvasObject, ObjectAnimation } from './types.ts'

const obj = (id: string, animation?: Partial<ObjectAnimation>): CanvasObject => ({
  id,
  type: 'stroke',
  layerId: 'l',
  tool: 'pen',
  color: '#000',
  width: 2,
  opacity: 1,
  points: [0, 0, 10, 10],
  ...(animation
    ? { animation: { effect: 'fade', start: 'tap', order: 0, duration: 400, ...animation } }
    : {}),
})

describe('slide steps', () => {
  it('groups objects into taps by their start', () => {
    const steps = slideSteps([
      obj('title', { order: 0, start: 'with' }),
      obj('a', { order: 1, start: 'tap' }),
      obj('b', { order: 2, start: 'with' }),
      obj('c', { order: 3, start: 'after' }),
      obj('d', { order: 4, start: 'tap' }),
      obj('still'),
    ])
    expect(steps.entry.map((i) => i.id)).toEqual(['title'])
    expect(steps.taps.map((t) => t.map((i) => i.id))).toEqual([['a', 'b', 'c'], ['d']])
    const [a, b, c] = steps.taps[0]!
    expect(a!.delay).toBe(0)
    expect(b!.delay).toBe(0)
    expect(c!.delay).toBe(400)
    expect(stepLength(steps.taps[0]!)).toBe(800)
  })

  it('follows the order, not the drawing order', () => {
    const steps = slideSteps([obj('second', { order: 2 }), obj('first', { order: 1 })])
    expect(steps.taps.map((t) => t[0]!.id)).toEqual(['first', 'second'])
  })
})
