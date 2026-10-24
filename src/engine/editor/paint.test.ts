import { describe, expect, it } from 'vitest'
import type { GradientPaint, StrokeObject, TableObject } from '../model/types.ts'
import { recolor, repaint } from './selection.ts'

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
})
