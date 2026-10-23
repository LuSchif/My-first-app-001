import { describe, expect, it } from 'vitest'
import { chainThrough, closedLoop, perfectShape, recognizeShape, regionAt } from './shapes.ts'

let seed = 11
const noise = (amount: number) => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * amount

function polygonStroke(corners: [number, number][], perEdge = 25, jitter = 1.5): number[] {
  const out: number[] = []
  for (let i = 0; i < corners.length; i++) {
    const [x0, y0] = corners[i]!
    const [x1, y1] = corners[(i + 1) % corners.length]!
    for (let k = 0; k < perEdge; k++) {
      const t = k / perEdge
      out.push(x0 + (x1 - x0) * t + noise(jitter), y0 + (y1 - y0) * t + noise(jitter))
    }
  }
  out.push(corners[0]![0] + 3, corners[0]![1] + 2)
  return out
}

function ellipseStroke(cx: number, cy: number, a: number, b: number, jitter = 1.5): number[] {
  const out: number[] = []
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * Math.PI * 2 + 0.3
    out.push(cx + a * Math.cos(t) + noise(jitter), cy + b * Math.sin(t) + noise(jitter))
  }
  return out
}

describe('recognizeShape', () => {
  it('recognizes circles and ellipses', () => {
    expect(recognizeShape(ellipseStroke(100, 100, 50, 49))?.kind).toBe('circle')
    expect(recognizeShape(ellipseStroke(100, 100, 80, 40))?.kind).toBe('ellipse')
  })

  it('recognizes triangles, keeping their corners', () => {
    const shape = recognizeShape(
      polygonStroke([
        [0, 100],
        [60, 0],
        [140, 100],
      ]),
    )
    expect(shape?.kind).toBe('triangle')
    expect(shape?.straight).toBe(true)
    expect(shape?.points.length).toBe(6)
  })

  it('straightens a rotated rectangle and keeps its size', () => {
    const r = (x: number, y: number): [number, number] => {
      const a = 0.3
      return [x * Math.cos(a) - y * Math.sin(a) + 200, x * Math.sin(a) + y * Math.cos(a) + 200]
    }
    const shape = recognizeShape(polygonStroke([r(0, 0), r(160, 0), r(160, 90), r(0, 90)]))
    expect(shape?.kind).toBe('rectangle')
    const p = shape!.points
    const side = Math.hypot(p[2]! - p[0]!, p[3]! - p[1]!)
    expect(side).toBeGreaterThan(150)
    expect(side).toBeLessThan(170)
  })

  it('recognizes pentagons', () => {
    const corners = Array.from({ length: 5 }, (_, i): [number, number] => {
      const t = (i / 5) * Math.PI * 2 - Math.PI / 2
      return [100 + 70 * Math.cos(t), 100 + 70 * Math.sin(t)]
    })
    expect(recognizeShape(polygonStroke(corners))?.kind).toBe('pentagon')
  })

  it('recognizes U-shaped curves', () => {
    const pts: number[] = []
    for (let i = 0; i <= 60; i++) {
      const x = -60 + i * 2
      pts.push(x + 200 + noise(1), 0.03 * x * x + 100 + noise(1))
    }
    expect(recognizeShape(pts)?.kind).toBe('parabola')
  })

  it('leaves handwriting-like scribbles alone', () => {
    const pts: number[] = []
    for (let i = 0; i < 120; i++) pts.push(i * 2, Math.sin(i / 3) * 12 + Math.sin(i / 7) * 9)
    expect(recognizeShape(pts)).toBeNull()
  })
})

describe('regions', () => {
  it('finds a stroke that closes on itself', () => {
    expect(closedLoop(ellipseStroke(0, 0, 40, 40))).not.toBeNull()
    expect(closedLoop([0, 0, 50, 0, 100, 0, 150, 0, 200, 0, 250, 0])).toBeNull()
  })

  it('finds the area enclosed by several strokes joined end to end', () => {
    const lines = [
      { id: 'a', points: [0, 100, 30, 50, 60, 0] },
      { id: 'b', points: [62, 2, 100, 50, 140, 100] },
      { id: 'c', points: [138, 101, 70, 100, 2, 99] },
    ]
    const region = regionAt(lines, 70, 70)
    expect(region?.sourceIds.sort()).toEqual(['a', 'b', 'c'])
    expect(regionAt(lines, 300, 300)).toBeNull()
  })

  it('picks the smallest area around the point', () => {
    const big = { id: 'big', points: ellipseStroke(100, 100, 90, 90, 0) }
    const small = { id: 'small', points: ellipseStroke(100, 100, 30, 30, 0) }
    expect(regionAt([big, small], 100, 100)?.sourceIds).toEqual(['small'])
    expect(regionAt([big, small], 100, 160)?.sourceIds).toEqual(['big'])
  })
})

describe('lines, chains and perfect shapes', () => {
  it('recognizes a shaky straight line', () => {
    const pts: number[] = []
    for (let i = 0; i <= 40; i++) pts.push(100 + i * 5 + noise(1.5), 100 + i * 1 + noise(1.5))
    expect(recognizeShape(pts)?.kind).toBe('line')
  })

  it('finds a square drawn as four separate sides', () => {
    const sides = [
      { id: 'a', points: [0, 0, 50, 1, 100, 0] },
      { id: 'b', points: [101, 2, 100, 50, 99, 100] },
      { id: 'c', points: [98, 101, 50, 100, 1, 99] },
      { id: 'd', points: [0, 98, 1, 50, 2, 3] },
    ]
    const chain = chainThrough(sides, 'c')
    expect(chain?.ids.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(recognizeShape(chain!.points)?.kind).toBe('square')
  })

  it('makes a perfect, equal-sided triangle of the same size', () => {
    const drawn = recognizeShape(
      polygonStroke([
        [0, 100],
        [30, 0],
        [150, 90],
      ]),
    )!
    const perfect = perfectShape(drawn)
    const p = perfect.points
    const sides = [0, 1, 2].map((i) => {
      const j = (i + 1) % 3
      return Math.hypot(p[j * 2]! - p[i * 2]!, p[j * 2 + 1]! - p[i * 2 + 1]!)
    })
    expect(Math.max(...sides) - Math.min(...sides)).toBeLessThan(0.01)
    expect(sides[0]).toBeGreaterThan(60)
    expect(sides[0]).toBeLessThan(160)
  })

  it('turns an ellipse into a circle and snaps a nearly level line', () => {
    expect(perfectShape(recognizeShape(ellipseStroke(100, 100, 80, 40))!).kind).toBe('circle')
    const line = perfectShape({
      kind: 'line',
      label: 'Line',
      points: [0, 0, 100, 4],
      closed: false,
      straight: true,
    })
    expect(line.points[3]).toBeCloseTo(0)
  })
})
