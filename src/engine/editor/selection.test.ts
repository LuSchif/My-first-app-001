import { describe, expect, it } from 'vitest'
import type { StrokeObject } from '../model/types.ts'
import { lassoCatches, pointInPolygon, transformObject, transformPoint } from './selection.ts'

const square = [0, 0, 100, 0, 100, 100, 0, 100]

const stroke = (points: number[]): StrokeObject => ({
  id: 's',
  type: 'stroke',
  layerId: 'l',
  tool: 'pen',
  color: '#000000',
  width: 2,
  opacity: 1,
  points,
})

describe('lasso', () => {
  it('finds points inside a polygon', () => {
    expect(pointInPolygon(50, 50, square)).toBe(true)
    expect(pointInPolygon(150, 50, square)).toBe(false)
  })

  it('catches a stroke when most of it is inside', () => {
    expect(lassoCatches(stroke([10, 10, 50, 50, 90, 90, 120, 120]), square)).toBe(true)
    expect(lassoCatches(stroke([10, 10, 120, 120, 130, 130, 140, 140]), square)).toBe(false)
  })
})

describe('transforms', () => {
  it('rotates a quarter turn around the center', () => {
    const p = transformPoint({ cx: 0, cy: 0, dx: 0, dy: 0, scale: 1, angle: Math.PI / 2 }, 10, 0)
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(10)
  })

  it('scales strokes and their line width together', () => {
    const t = { cx: 0, cy: 0, dx: 5, dy: 0, scale: 2, angle: 0 }
    const out = transformObject(stroke([1, 1, 2, 2]), t) as StrokeObject
    expect(out.points).toEqual([7, 2, 9, 4])
    expect(out.width).toBe(4)
  })
})
