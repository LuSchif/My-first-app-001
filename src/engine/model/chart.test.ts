import { describe, expect, it } from 'vitest'
import { niceScale } from '../render/chart.ts'
import { addCategory, addSeries, createChart, removeCategory, setValue } from './chart.ts'

const frame = { x: 0, y: 0, width: 300, height: 200, rotation: 0 }

describe('charts', () => {
  it('keeps every series as long as the labels', () => {
    let c = createChart('c', 'l', frame, 'bar')
    c = addCategory(c)
    c = addSeries(c)
    expect(c.series.every((s) => s.values.length === c.labels.length)).toBe(true)
    c = removeCategory(c, 0)
    expect(c.series.every((s) => s.values.length === c.labels.length)).toBe(true)
    expect(setValue(c, 1, 0, 42).series[1]!.values[0]).toBe(42)
  })

  it('picks round scale steps', () => {
    expect(niceScale(9)).toEqual({ top: 10, step: 2.5 })
    expect(niceScale(97)).toEqual({ top: 100, step: 25 })
    expect(niceScale(0)).toEqual({ top: 1, step: 0.25 })
  })
})
