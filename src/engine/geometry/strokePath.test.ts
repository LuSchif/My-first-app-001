import { describe, expect, it } from 'vitest'
import {
  smoothedAt,
  smoothPoints,
  traceSegments,
  traceStroke,
  type PathSink,
} from './strokePath.ts'

function recorder() {
  const calls: number[][] = []
  const sink: PathSink = {
    moveTo: (...a) => calls.push(['M'.charCodeAt(0), ...a]),
    lineTo: (...a) => calls.push(['L'.charCodeAt(0), ...a]),
    bezierCurveTo: (...a) => calls.push(['C'.charCodeAt(0), ...a]),
  }
  return { sink, calls }
}

// A wobbly line, as a hand would draw it.
const raw = Array.from({ length: 40 }, (_, i) => [
  i * 3,
  Math.sin(i / 3) * 10 + (i % 2) * 0.6,
]).flat()

describe('smoothPoints', () => {
  it('keeps both ends where the pen touched down and lifted', () => {
    const s = smoothPoints(raw)
    expect(s.slice(0, 2)).toEqual(raw.slice(0, 2))
    expect(s.slice(-2)).toEqual(raw.slice(-2))
  })

  it('reduces jitter', () => {
    const s = smoothPoints(raw)
    const roughness = (p: number[]) => {
      let sum = 0
      for (let i = 1; i < p.length / 2 - 1; i++) {
        sum += Math.abs(p[i * 2 + 1]! * 2 - p[i * 2 - 1]! - p[i * 2 + 3]!)
      }
      return sum
    }
    expect(roughness(s)).toBeLessThan(roughness(raw) * 0.6)
  })
})

describe('traceSegments', () => {
  it('draws the same curve whether traced at once or in pieces as the pen moves', () => {
    const points = smoothPoints(raw)
    const whole = recorder()
    traceStroke(whole.sink, points)

    // Live drawing: settled segments in chunks, using only points known at that time.
    const live = recorder()
    live.sink.moveTo(points[0]!, points[1]!)
    let drawn = 0
    for (let n = 1; n <= raw.length / 2; n++) {
      const known = raw.slice(0, n * 2)
      const smooth: number[] = []
      for (let i = 0; i <= n - 3; i++) smooth.push(...smoothedAt(known, i))
      const settled = smooth.length / 2 - 2
      if (settled > drawn) {
        traceSegments(live.sink, smooth, drawn, settled)
        drawn = settled
      }
    }
    const settledCalls = live.calls.length
    expect(settledCalls).toBeGreaterThan(30)
    for (let i = 0; i < settledCalls; i++) {
      expect(live.calls[i]!.map((v) => Math.round(v * 1e6))).toEqual(
        whole.calls[i]!.map((v) => Math.round(v * 1e6)),
      )
    }
  })
})
