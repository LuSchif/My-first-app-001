import { tableChartData } from './table.ts'
import type { BoxFrame, CanvasObject, ChartKind, ChartObject, Id, TableObject } from './types.ts'

export const CHART_COLORS = ['#b98b65', '#4a80c0', '#8fc172', '#e0715f', '#8063b4', '#3d9687']

export const CHART_KINDS: { kind: ChartKind; label: string }[] = [
  { kind: 'bar', label: 'Bars' },
  { kind: 'line', label: 'Line' },
  { kind: 'pie', label: 'Pie' },
  { kind: 'donut', label: 'Donut' },
]

/** A new chart with a little sample data to edit, so it never starts empty. */
export function createChart(id: Id, layerId: Id, frame: BoxFrame, kind: ChartKind): ChartObject {
  const round = kind === 'pie' || kind === 'donut'
  return {
    id,
    type: 'chart',
    layerId,
    ...frame,
    kind,
    title: '',
    labels: round ? ['A', 'B', 'C'] : ['Mon', 'Tue', 'Wed', 'Thu'],
    series: round
      ? [{ name: 'Share', color: CHART_COLORS[0]!, values: [50, 30, 20] }]
      : [
          { name: 'Series 1', color: CHART_COLORS[0]!, values: [4, 7, 5, 9] },
          { name: 'Series 2', color: CHART_COLORS[1]!, values: [2, 5, 6, 4] },
        ],
    legend: true,
    grid: true,
    values: false,
    textColor: '#3e2d25',
    fontSize: 10,
  }
}

export function addCategory(chart: ChartObject): ChartObject {
  return {
    ...chart,
    labels: [...chart.labels, String.fromCharCode(65 + (chart.labels.length % 26))],
    series: chart.series.map((s) => ({ ...s, values: [...s.values, 0] })),
  }
}

export function removeCategory(chart: ChartObject, index: number): ChartObject {
  if (chart.labels.length <= 1) return chart
  return {
    ...chart,
    labels: chart.labels.filter((_, i) => i !== index),
    series: chart.series.map((s) => ({ ...s, values: s.values.filter((_, i) => i !== index) })),
  }
}

export function addSeries(chart: ChartObject): ChartObject {
  const color =
    CHART_COLORS.find((c) => !chart.series.some((s) => s.color === c)) ?? CHART_COLORS[0]!
  return {
    ...chart,
    series: [
      ...chart.series,
      { name: `Series ${chart.series.length + 1}`, color, values: chart.labels.map(() => 0) },
    ],
  }
}

export function removeSeries(chart: ChartObject, index: number): ChartObject {
  if (chart.series.length <= 1) return chart
  return { ...chart, series: chart.series.filter((_, i) => i !== index) }
}

export function setValue(chart: ChartObject, series: number, index: number, value: number) {
  return {
    ...chart,
    series: chart.series.map((s, k) =>
      k === series ? { ...s, values: s.values.map((v, i) => (i === index ? value : v)) } : s,
    ),
  }
}

export type ChartSort = 'label' | 'ascending' | 'descending'

/** Reorders the categories: A to Z by label, or by the first series' values. */
export function sortChart(chart: ChartObject, by: ChartSort): ChartObject {
  const order = chart.labels.map((_, i) => i)
  const first = chart.series[0]?.values ?? []
  order.sort((a, b) => {
    if (by === 'label')
      return chart.labels[a]!.localeCompare(chart.labels[b]!, undefined, { numeric: true })
    const d = (first[a] ?? 0) - (first[b] ?? 0)
    return by === 'ascending' ? d : -d
  })
  return {
    ...chart,
    labels: order.map((i) => chart.labels[i]!),
    series: chart.series.map((s) => ({ ...s, values: order.map((i) => s.values[i] ?? 0) })),
  }
}

/** Swaps categories and series: what was a series becomes a category, and the other way round. */
export function transposeChart(chart: ChartObject): ChartObject {
  const series = chart.labels.map((label, i) => ({
    name: label,
    color: CHART_COLORS[i % CHART_COLORS.length]!,
    values: chart.series.map((s) => s.values[i] ?? 0),
  }))
  return { ...chart, labels: chart.series.map((s) => s.name), series }
}

export interface SeriesStats {
  sum: number
  average: number
  min: number
  max: number
}

export function seriesStats(values: readonly number[]): SeriesStats | null {
  const v = values.filter(Number.isFinite)
  if (v.length === 0) return null
  const sum = v.reduce((a, b) => a + b, 0)
  return { sum, average: sum / v.length, min: Math.min(...v), max: Math.max(...v) }
}

/** A chart showing a table's numbers (see `tableChartData`). */
export function chartFromData(
  id: Id,
  layerId: Id,
  frame: BoxFrame,
  kind: ChartKind,
  data: { labels: string[]; series: { name: string; values: number[] }[] },
): ChartObject {
  return {
    ...createChart(id, layerId, frame, kind),
    labels: data.labels,
    series: data.series.map((s, k) => ({ ...s, color: CHART_COLORS[k % CHART_COLORS.length]! })),
  }
}

/**
 * Charts made from a table follow it: after a change to the page, every linked chart whose
 * table now holds other data gets that data (its type, colors and look stay). A chart whose
 * table is gone keeps its last values.
 */
export function followTables(
  before: readonly CanvasObject[],
  after: CanvasObject[],
): CanvasObject[] {
  const linked = after.some((o) => o.type === 'chart' && o.sourceTableId)
  if (!linked) return after
  const old = new Set(before)
  const tables = new Map<Id, TableObject>()
  for (const o of after) if (o.type === 'table' && !old.has(o)) tables.set(o.id, o)
  if (tables.size === 0) return after
  return after.map((o) => {
    if (o.type !== 'chart' || !o.sourceTableId) return o
    const table = tables.get(o.sourceTableId)
    if (!table) return o
    const data = tableChartData(table)
    if (data.series.length === 0) return o
    const series = data.series.map((s, k) => ({
      ...s,
      color: o.series[k]?.color ?? CHART_COLORS[k % CHART_COLORS.length]!,
    }))
    if (
      JSON.stringify(o.labels) === JSON.stringify(data.labels) &&
      JSON.stringify(o.series) === JSON.stringify(series)
    ) {
      return o
    }
    return { ...o, labels: data.labels, series }
  })
}
