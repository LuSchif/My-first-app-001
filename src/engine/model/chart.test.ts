import { describe, expect, it } from 'vitest'
import { niceScale } from '../render/chart.ts'
import { createTable, tableChartData } from './table.ts'
import {
  addCategory,
  addSeries,
  chartFromData,
  createChart,
  followTables,
  removeCategory,
  seriesStats,
  setValue,
  sortChart,
  transposeChart,
} from './chart.ts'

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

describe('chart data tools', () => {
  const chart = createChart('c', 'l', frame, 'bar')
  it('sorts categories by the first series', () => {
    const sorted = sortChart(chart, 'descending')
    expect(sorted.series[0]!.values).toEqual([9, 7, 5, 4])
    expect(sorted.labels).toEqual(['Thu', 'Tue', 'Wed', 'Mon'])
  })
  it('transposes categories and series', () => {
    const t = transposeChart(chart)
    expect(t.labels).toEqual(['Series 1', 'Series 2'])
    expect(t.series).toHaveLength(4)
    expect(t.series[0]!.values).toEqual([4, 2])
    expect(transposeChart(t).series[1]!.values).toEqual(chart.series[1]!.values)
  })
  it('sums up a series', () => {
    expect(seriesStats([4, 7, 5, 9])).toEqual({ sum: 25, average: 6.25, min: 4, max: 9 })
  })
})

describe('charts made from a table', () => {
  it('follow the table when it changes', () => {
    const frame = { x: 0, y: 0, width: 200, height: 100, rotation: 0 }
    const base = createTable('t', 'l', frame, 2, 2)
    const table = {
      ...base,
      cells: [
        ['hans', 'wurst'],
        ['100', '150'],
      ],
    }
    const chart = {
      ...chartFromData('c', 'l', frame, 'pie', tableChartData(table)),
      sourceTableId: 't',
    }
    const edited = {
      ...table,
      cells: [
        ['Kiddo', 'Pampers'],
        ['100', '150'],
      ],
    }
    const [, followed] = followTables([table, chart], [edited, chart])
    expect(followed?.type === 'chart' && followed.labels).toEqual(['Kiddo', 'Pampers'])
    expect(followed?.type === 'chart' && followed.kind).toBe('pie')
    // Nothing changed in the table: the chart stays the same object.
    const [, same] = followTables([table, chart], [table, chart])
    expect(same).toBe(chart)
  })
})
