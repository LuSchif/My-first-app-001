import { describe, expect, it } from 'vitest'
import type { StrokeObject } from '../model/types.ts'
import {
  flipObject,
  lassoCatches,
  pointInPolygon,
  transformObject,
  transformPoint,
} from './selection.ts'

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

  it('catches a stroke when any part of it is inside', () => {
    expect(lassoCatches(stroke([90, 90, 150, 150, 200, 200]), square)).toBe(true)
    expect(lassoCatches(stroke([120, 120, 130, 130, 140, 140]), square)).toBe(false)
  })

  it('catches a long straight segment that crosses the loop between its samples', () => {
    const thin = [40, -10, 60, -10, 60, 110, 40, 110]
    expect(lassoCatches(stroke([0, 50, 100, 50]), thin)).toBe(true)
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

describe('flip', () => {
  it('mirrors strokes across the selection center', () => {
    const out = flipObject(stroke([10, 0, 30, 5]), 'horizontal', 20, 0) as StrokeObject
    expect(out.points).toEqual([30, 0, 10, 5])
    const v = flipObject(stroke([10, 0, 30, 5]), 'vertical', 0, 10) as StrokeObject
    expect(v.points).toEqual([10, 20, 30, 15])
  })
})
