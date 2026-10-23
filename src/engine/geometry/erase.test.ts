import { describe, expect, it } from 'vitest'
import { eraseFromPoints, strokeTouchesCircle } from './erase.ts'

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
