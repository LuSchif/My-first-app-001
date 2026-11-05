import { describe, expect, it } from 'vitest'
import {
  SMOOTH_RADIUS,
  smoothAlong,
  smoothedAt,
  finishPoints,
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
      for (let i = 0; i <= n - 1 - SMOOTH_RADIUS; i++) smooth.push(...smoothedAt(known, i))
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

describe('finishPoints', () => {
  it('keeps the ends and moves inner points only a little', () => {
    const raw = [0, 0, 10, 1, 20, -1, 30, 1, 40, 0]
    const out = finishPoints(raw)
    expect(out.slice(0, 2)).toEqual([0, 0])
    expect(out.slice(-2)).toEqual([40, 0])
    for (let i = 0; i < raw.length; i++) expect(Math.abs(out[i]! - raw[i]!)).toBeLessThanOrEqual(1)
    // The zigzag gets flatter.
    expect(Math.abs(out[3]!)).toBeLessThan(1)
  })
})

describe('smoothAlong', () => {
  it('keeps a straight line, its ends and its point count', () => {
    const line = Array.from({ length: 30 }, (_, i) => [i * 3, i * 1.5]).flat()
    const out = smoothAlong(line, 6)
    expect(out).toHaveLength(line.length)
    for (let i = 0; i < out.length; i++) expect(out[i]).toBeCloseTo(line[i]!, 6)
  })

  it('takes the wobble out of a fast line without a hook at the ends', () => {
    const wobbly = Array.from({ length: 60 }, (_, i) => [i * 5, i % 2 ? 1.5 : -1.5]).flat()
    wobbly[1] = 0
    const out = smoothAlong(wobbly, 6)
    const ys = out.filter((_, k) => k % 2 === 1)
    expect(Math.max(...ys.slice(3, -3).map(Math.abs))).toBeLessThan(0.3)
    expect(out[0]).toBe(0)
    expect(out[1]).toBeCloseTo(0, 6)
  })
})
