import { describe, expect, it } from 'vitest'
import type { FillObject, GradientPaint, StrokeObject, TableObject } from '../model/types.ts'
import { objectBounds, paintBounds } from '../render/objects.ts'
import { recolor, repaint, withShadow } from './selection.ts'

const stroke: StrokeObject = {
  id: 's',
  type: 'stroke',
  layerId: 'l',
  tool: 'pen',
  color: '#000000',
  width: 2,
  opacity: 1,
  points: [0, 0, 100, 0],
}
const gradient: GradientPaint = {
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: '#ff0000' },
    { offset: 1, color: '#0000ff' },
  ],
}

describe('painting objects', () => {
  it('paints ink with a gradient, keeping its first color as the plain color', () => {
    const painted = repaint(stroke, gradient) as StrokeObject
    expect(painted.gradient).toEqual(gradient)
    expect(painted.color).toBe('#ff0000')
    const plain = recolor(painted, '#00ff00') as StrokeObject
    expect(plain.gradient).toBeUndefined()
    expect(plain.color).toBe('#00ff00')
  })

  it('gives tables the gradient’s first color instead of a gradient', () => {
    const table = { type: 'table', style: { lineColor: '#000000' } } as unknown as TableObject
    const painted = repaint(table, gradient) as TableObject
    expect(painted.style.lineColor).toBe('#ff0000')
    expect('gradient' in painted).toBe(false)
  })

  it('adds and removes shadows; what is painted includes the shadow, the selection does not', () => {
    const fill: FillObject = {
      id: 'f',
      type: 'fill',
      layerId: 'l',
      color: '#000000',
      opacity: 1,
      smooth: false,
      points: [0, 0, 10, 0, 10, 10, 0, 10],
    }
    const shadowed = withShadow(fill, {
      color: '#000000',
      opacity: 0.4,
      blur: 4,
      distance: 3,
      angle: 90,
    })
    expect(paintBounds(shadowed).maxY).toBeGreaterThan(objectBounds(fill).maxY + 5)
    expect(objectBounds(shadowed)).toEqual(objectBounds(fill))
    expect(withShadow(shadowed, null).shadow).toBeUndefined()
  })
})
