import { describe, expect, it } from 'vitest'
import type { StrokeObject } from '../../engine/model/types.ts'
import { inkOf } from './readText.ts'

const stroke = (extra: Partial<StrokeObject>): StrokeObject => ({
  id: Math.random().toString(36),
  type: 'stroke',
  layerId: 'l',
  tool: 'pen',
  color: '#000',
  width: 2,
  opacity: 1,
  points: [0, 0, 10, 0],
  ...extra,
})

describe('inkOf', () => {
  it('reads straight pen strokes (the bar of a T), but not highlighter or generated ones', () => {
    const bar = stroke({ straight: true })
    const stem = stroke({ points: [5, 0, 5, 20] })
    const marker = stroke({ tool: 'highlighter' })
    const generated = stroke({
      written: {
        id: 'w',
        text: 'Hallo',
        layout: { x: 0, y: 0, width: 100, size: 16, lineHeight: 1.4 },
        box: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
      },
    })
    expect(inkOf([bar, stem, marker, generated]).map((i) => i.points)).toEqual([
      bar.points,
      stem.points,
    ])
  })
})
