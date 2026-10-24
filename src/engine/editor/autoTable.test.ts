import { describe, expect, it } from 'vitest'
import type { StrokeObject } from '../model/types.ts'
import { suggestFor } from './suggestions.ts'

let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
let n = 0
/** A hand-drawn line through the given points, slightly shaky. */
function stroke(...corners: [number, number][]): StrokeObject {
  const points: number[] = []
  for (let k = 0; k + 1 < corners.length; k++) {
    const [x0, y0] = corners[k]!
    const [x1, y1] = corners[k + 1]!
    const steps = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3))
    for (let i = k === 0 ? 0 : 1; i <= steps; i++) {
      points.push(
        x0 + ((x1 - x0) * i) / steps + (rnd() - 0.5),
        y0 + ((y1 - y0) * i) / steps + (rnd() - 0.5),
      )
    }
  }
  return {
    id: `s${++n}`,
    type: 'stroke',
    layerId: 'l',
    tool: 'pen',
    color: '#c4473a',
    width: 3,
    opacity: 1,
    points,
  }
}

describe('Auto table from hand-drawn tables', () => {
  // Traced from a drawing on the iPad (page points): one line across, five dividers through it.
  const fence = () => [
    stroke([343, 414], [768, 402]),
    stroke([385, 345], [384, 495]),
    stroke([463, 357], [461, 458]),
    stroke([532, 355], [531, 480]),
    stroke([603, 350], [602, 482]),
    stroke([683, 357], [684, 450], [677, 497]),
  ]

  it('offers a table for one line with dividers, whichever is drawn last', () => {
    for (const last of [0, 5]) {
      const strokes = fence()
      const s = suggestFor(strokes, strokes[last]!)
      expect(s?.kind).toBe('table')
    }
  })

  it('offers a table for a # grid and a framed grid', () => {
    const hash = [
      stroke([100, 140], [300, 142]),
      stroke([100, 200], [300, 198]),
      stroke([160, 100], [162, 240]),
      stroke([240, 102], [238, 240]),
    ]
    expect(suggestFor(hash, hash[3]!)?.kind).toBe('table')
    const framed = [
      stroke([50, 50], [250, 50], [250, 150], [50, 150], [50, 50]),
      stroke([150, 50], [150, 150]),
    ]
    expect(suggestFor(framed, framed[1]!)?.kind).toBe('table')
  })

  it('makes dividers equally long: the table spans the drawing', () => {
    const strokes = fence()
    const s = suggestFor(strokes, strokes[5]!)
    if (s?.kind !== 'table') throw new Error('no table')
    expect(s.ys[0]).toBeLessThan(352)
    expect(s.ys.at(-1)!).toBeGreaterThan(490)
  })
})
