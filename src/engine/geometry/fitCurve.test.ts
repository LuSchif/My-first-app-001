import { describe, expect, it } from 'vitest'
import { fitPath, samplePath } from './fitCurve.ts'

const anchors = (path: number[]) => (path.length - 2) / 6 + 1

/** Largest distance from any drawn point to the fitted curve. */
function deviation(points: number[], path: number[]): number {
  const curve = samplePath(path, 0.2)
  let worst = 0
  for (let i = 0; i < points.length; i += 2) {
    let best = Infinity
    for (let k = 0; k < curve.length; k += 2) {
      best = Math.min(best, Math.hypot(curve[k]! - points[i]!, curve[k + 1]! - points[i + 1]!))
    }
    worst = Math.max(worst, best)
  }
  return worst
}

describe('fitPath', () => {
  it('follows a circle closely with only a few anchors', () => {
    const pts = Array.from({ length: 200 }, (_, i) => {
      const a = (i / 199) * Math.PI * 2
      return [100 + Math.cos(a) * 60, 100 + Math.sin(a) * 60]
    }).flat()
    const path = fitPath(pts, { tolerance: 1 })
    expect(deviation(pts, path)).toBeLessThan(1.05)
    expect(anchors(path)).toBeLessThanOrEqual(9)
    expect(path.slice(0, 2)).toEqual(pts.slice(0, 2))
    expect(path.slice(-2)).toEqual(pts.slice(-2))
  })

  it('keeps the sharp tip of a V as an anchor', () => {
    const down = Array.from({ length: 40 }, (_, i) => [i, i * 2])
    const up = Array.from({ length: 40 }, (_, i) => [40 + i, 80 - i * 2])
    const path = fitPath([...down, ...up].flat())
    const tips: [number, number][] = []
    for (let i = 0; i < path.length; i += i === 0 ? 2 : 6) {
      const k = i === 0 ? 0 : i + 4
      tips.push([path[k]!, path[k + 1]!])
    }
    expect(tips.some(([x, y]) => Math.hypot(x - 40, y - 80) < 1.5)).toBe(true)
  })

  it('handles tiny strokes', () => {
    expect(fitPath([5, 5])).toEqual([5, 5])
    expect(anchors(fitPath([0, 0, 10, 0]))).toBe(2)
  })
})
