import type { BoxFrame, ChartKind, ChartObject, Id } from './types.ts'

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
