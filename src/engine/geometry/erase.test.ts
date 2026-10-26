import { describe, expect, it } from 'vitest'
import { eraseFromPoints, eraseFromStroke, strokeTouchesCircle } from './erase.ts'

const line = [0, 0, 100, 0] // two samples, 100 pt apart

describe('eraseFromPoints', () => {
  it('cuts a gap where the broom passes, even between distant samples', () => {
    const pieces = eraseFromPoints(line, 50, 0, 5)!
    expect(pieces).toHaveLength(2)
    const left = pieces[0]!
    const right = pieces[1]!
    expect(left[left.length - 2]).toBeLessThan(45.01)
    expect(right[0]).toBeGreaterThan(54.99)
  })

  it('returns null when the broom misses', () => {
    expect(eraseFromPoints(line, 50, 20, 5)).toBeNull()
  })

  it('removes the whole stroke when the broom covers it', () => {
    expect(eraseFromPoints([0, 0, 2, 0], 1, 0, 10)).toEqual([])
  })
})

describe('strokeTouchesCircle', () => {
  it('detects a segment passing through the circle', () => {
    expect(strokeTouchesCircle(line, 50, 3, 4)).toBe(true)
    expect(strokeTouchesCircle(line, 50, 6, 4)).toBe(false)
  })
})

describe('erasing keeps what was recorded', () => {
  it('splits widths and input with the points, each piece on its own clock', () => {
    // A line from x=0 to x=100, a point every 10, cut in the middle.
    const points = Array.from({ length: 11 }, (_, i) => [i * 10, 0]).flat()
    const widths = Array.from({ length: 11 }, (_, i) => 1 + i / 10)
    const input = {
      device: 'pen' as const,
      t: Array.from({ length: 11 }, (_, i) => i * 8),
      p: Array.from({ length: 11 }, (_, i) => i / 10),
      altitude: Array.from({ length: 11 }, () => 50),
      azimuth: Array.from({ length: 11 }, () => 30),
    }
    const pieces = eraseFromStroke(points, widths, 50, 0, 6, input)!
    expect(pieces).toHaveLength(2)
    for (const piece of pieces) {
      const n = piece.points.length / 2
      expect(piece.widths).toHaveLength(n)
      expect(piece.input!.t).toHaveLength(n)
      expect(piece.input!.p).toHaveLength(n)
      expect(piece.input!.altitude).toHaveLength(n)
      expect(piece.input!.azimuth).toHaveLength(n)
      expect(piece.input!.t[0]).toBe(0)
      expect(piece.input!.device).toBe('pen')
    }
    // The right piece starts after the cut, with the pressure that was recorded there.
    const right = pieces[1]!
    expect(right.points[0]).toBeGreaterThan(56)
    expect(right.input!.p[0]).toBeCloseTo(right.points[0]! / 100, 5)
    expect(right.widths![0]).toBeCloseTo(1 + right.points[0]! / 100, 5)
  })

  it('leaves input behind when it does not match the points', () => {
    const points = [0, 0, 10, 0, 20, 0, 30, 0, 40, 0]
    const input = { device: 'mouse' as const, t: [0, 1], p: [0.5, 0.5] }
    const pieces = eraseFromStroke(points, undefined, 20, 0, 3, input)!
    expect(pieces.every((p) => p.input === undefined)).toBe(true)
  })
})
