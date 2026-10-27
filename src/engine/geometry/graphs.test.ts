import { describe, expect, it } from 'vitest'
import { detectGraph } from './graphs.ts'

let seed = 9
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2
const line = (x0: number, y0: number, x1: number, y1: number, n = 30) =>
  Array.from({ length: n + 1 }, (_, i) => [
    x0 + ((x1 - x0) * i) / n + rnd() * 0.8,
    y0 + ((y1 - y0) * i) / n + rnd() * 0.8,
  ]).flat()

describe('graph axes', () => {
  it('turns an "L" with a head at the right into axes with heads right and top', () => {
    const l = { id: 'a', points: [...line(100, 50, 102, 250), ...line(102, 250, 320, 246)] }
    const head = {
      id: 'b',
      points: [...line(305, 236, 321, 247, 6), ...line(321, 247, 304, 258, 6)],
    }
    const graph = detectGraph([l, head])
    expect(graph?.ids).toEqual(['a', 'b'])
    const [h, v, right, top] = graph!.lines
    // The axes meet at the corner.
    expect(h![0]).toBeCloseTo(v![0]!, 5)
    expect(v![1]).toBeCloseTo(h![1]!, 5)
    // Heads at the right end and the top.
    expect(right![2]).toBeCloseTo(h![2]!, 5)
    expect(top![3]).toBeCloseTo(v![3]!, 5)
    expect(top![3]).toBeLessThan(top![1]!)
  })

  it('turns a cross with a head at the top into axes', () => {
    const across = { id: 'a', points: line(80, 200, 400, 196) }
    const up = { id: 'b', points: line(240, 360, 236, 60) }
    const head = { id: 'c', points: [...line(222, 78, 236, 58, 6), ...line(236, 58, 252, 76, 6)] }
    const graph = detectGraph([across, up, head])
    expect(graph).not.toBeNull()
    const [h, v] = graph!.lines
    expect(h![0]).toBeLessThan(100)
    expect(v![1]).toBeGreaterThan(340)
  })

  it('turns a cross with a slanted third axis into three axes with heads at their tops', () => {
    const across = { id: 'a', points: line(80, 200, 400, 206) }
    const up = { id: 'b', points: line(240, 40, 240, 340) }
    const slant = { id: 'c', points: line(140, 300, 340, 120) }
    // The head drawn on the slanted axis.
    const head = {
      id: 'd',
      points: [...line(318, 122, 341, 119, 6), ...line(341, 119, 336, 142, 6)],
    }
    const graph = detectGraph([across, up, slant, head])
    expect(graph?.lines).toHaveLength(6)
    const [h, v, right, top, d, dHead] = graph!.lines
    expect(right![2]).toBeCloseTo(h![2]!, 5)
    expect(top![3]).toBeCloseTo(v![3]!, 5)
    // The slanted axis ends at its upper end, where its head is.
    expect(d![3]).toBeLessThan(d![1]!)
    expect(dHead![2]).toBeCloseTo(d![2]!, 5)
    // A head on the horizontal axis gives the slanted one a head too.
    const onRight = {
      id: 'e',
      points: [...line(384, 192, 401, 206, 6), ...line(401, 206, 384, 218, 6)],
    }
    expect(detectGraph([across, up, slant, onRight])?.lines).toHaveLength(6)
  })

  it('needs a head at an axis end', () => {
    const l = { id: 'a', points: [...line(100, 50, 102, 250), ...line(102, 250, 320, 246)] }
    const stray = {
      id: 'b',
      points: [...line(190, 130, 206, 141, 6), ...line(206, 141, 189, 152, 6)],
    }
    expect(detectGraph([l, stray])).toBeNull()
  })

  it('ignores slanted lines', () => {
    const a = { id: 'a', points: line(100, 100, 300, 200) }
    const b = { id: 'b', points: line(100, 300, 300, 100) }
    const head = { id: 'c', points: [...line(285, 100, 301, 99, 6), ...line(301, 99, 296, 115, 6)] }
    expect(detectGraph([a, b, head])).toBeNull()
  })
})
