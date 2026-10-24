import { describe, expect, it } from 'vitest'
import { samplePath } from './fitCurve.ts'
import {
  anchorCount,
  anchorIndex,
  deleteAnchor,
  editablePath,
  insertAnchor,
  isClosedPath,
  isStraightSegment,
  isSmooth,
  moveAnchor,
  moveHandle,
  nearestOnPath,
} from './pathEdit.ts'

// Two segments: (0,0) → (100,0) → (200,0), with smooth horizontal handles.
const path = [0, 0, 30, 0, 70, 0, 100, 0, 130, 0, 170, 0, 200, 0]

describe('path editing', () => {
  it('moves an anchor with its handles on a curve', () => {
    const curve = [0, 0, 30, 20, 70, 20, 100, 0, 130, -20, 170, -20, 200, 0]
    const moved = moveAnchor(curve, 1, 0, 20)
    expect(moved.slice(anchorIndex(1), anchorIndex(1) + 2)).toEqual([100, 20])
    expect(moved.slice(4, 6)).toEqual([70, 40])
    expect(moved.slice(8, 10)).toEqual([130, 0])
  })

  it('keeps straight segments straight when an anchor moves', () => {
    const moved = moveAnchor(path, 2, 0, 60)
    expect(isStraightSegment(moved, 1)).toBe(true)
    expect(isStraightSegment(moved, 0)).toBe(true)
  })

  it('makes a nearly straight drawn line a single straight segment', () => {
    const wobbly = Array.from({ length: 30 }, (_, i) => [i * 10, Math.sin(i) * 0.8]).flat()
    expect(anchorCount(editablePath({ points: wobbly }))).toBe(2)
  })

  it('keeps a smooth point smooth when a handle turns', () => {
    expect(isSmooth(path, 1)).toBe(true)
    const turned = moveHandle(path, 1, 'out', 130, 30, true)
    expect(isSmooth(turned, 1)).toBe(true)
    // The opposite handle kept its length of 30.
    expect(Math.hypot(turned[4]! - 100, turned[5]!)).toBeCloseTo(30)
  })

  it('inserts an anchor without changing the curve, and deletes it again', () => {
    const hit = nearestOnPath(path, 50, 3)!
    expect(hit.segment).toBe(0)
    const more = insertAnchor(path, hit.segment, hit.t)
    expect(anchorCount(more)).toBe(4)
    const a = samplePath(path, 5)
    const b = samplePath(more, 5)
    expect(Math.max(...b.filter((_, i) => i % 2).map(Math.abs))).toBeLessThan(1e-9)
    expect(a[0]).toBe(b[0])
    expect(anchorCount(deleteAnchor(more, 1))).toBe(3)
  })

  it('edits closed paths at their shared start', () => {
    const square = editablePath({
      points: [0, 0, 100, 0, 100, 100, 0, 100],
      closed: true,
      straight: true,
    })
    expect(isClosedPath(square)).toBe(true)
    expect(anchorCount(square)).toBe(5)
    const moved = moveAnchor(square, 0, -10, -10)
    expect(moved.slice(0, 2)).toEqual([-10, -10])
    expect(moved.slice(-2)).toEqual([-10, -10])
    const triangle = deleteAnchor(square, 0)
    expect(isClosedPath(triangle)).toBe(true)
    expect(anchorCount(triangle)).toBe(4)
  })
})
