import { enterBox } from '../geometry/box.ts'
import type { ChartObject } from '../model/types.ts'
import { strokeBoxOutline } from './outline.ts'
import { FONT_STACKS } from './text.ts'

const GRID_COLOR = 'rgba(62, 45, 37, 0.14)'
const AXIS_COLOR = 'rgba(62, 45, 37, 0.45)'

/** A round number at or above `max`, and a step that divides it into about four parts. */
export function niceScale(max: number): { top: number; step: number } {
  if (!(max > 0)) return { top: 1, step: 0.25 }
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!
  return { top: Math.ceil(max / step) * step, step }
}

export function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 1 : 0)
}

export function paintChart(ctx: CanvasRenderingContext2D, chart: ChartObject): void {
  const fs = chart.fontSize
  const font = (weight = 400, size = fs) => `${weight} ${size}px ${FONT_STACKS.sans}`
  ctx.save()
  enterBox(ctx, chart)
  ctx.beginPath()
  ctx.rect(0, 0, chart.width, chart.height)
  ctx.clip()

  let top = fs * 0.5
  if (chart.title) {
    ctx.font = font(700, fs * 1.25)
    ctx.fillStyle = chart.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(chart.title, chart.width / 2, top, chart.width)
    top += fs * 1.25 * 1.5
  }

  const round = chart.kind === 'pie' || chart.kind === 'donut'
  const legendItems = round
    ? chart.labels.map((label, i) => ({ label, color: sliceColor(chart, i) }))
    : chart.series.map((s) => ({ label: s.name, color: s.color }))
  let bottom = chart.height - fs * 0.5
  if (chart.legend && legendItems.length > 0) {
    bottom = paintLegend(ctx, chart, legendItems, bottom, font())
  }

  if (round) paintPie(ctx, chart, top, bottom, font)
  else paintAxes(ctx, chart, top, bottom, font)

  if (chart.outline) {
    ctx.restore()
    ctx.save()
    enterBox(ctx, chart)
    strokeBoxOutline(ctx, chart.width, chart.height, chart.outline)
  }
  ctx.restore()
}

/** Slice colors: the series colors first, then lighter and darker variations. */
function sliceColor(chart: ChartObject, i: number): string {
  const palette = chart.series.map((s) => s.color)
  const base = PALETTE.filter((c) => !palette.includes(c))
  const all = [...palette, ...base]
  return all[i % all.length]!
}

export const PALETTE = [
  '#b98b65',
  '#4a80c0',
  '#8fc172',
  '#e0715f',
  '#8063b4',
  '#f2cf4a',
  '#3d9687',
  '#795a46',
]

/** Draws the legend in rows at the bottom and returns the space left above it. */
function paintLegend(
  ctx: CanvasRenderingContext2D,
  chart: ChartObject,
  items: { label: string; color: string }[],
  bottom: number,
  font: string,
): number {
  const fs = chart.fontSize
  ctx.font = font
  const gap = fs
  const widths = items.map((it) => fs * 1.4 + ctx.measureText(it.label).width)
  const rows: number[][] = [[]]
  let used = 0
  widths.forEach((w, i) => {
    if (used > 0 && used + w > chart.width - fs * 2) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1]!.push(i)
    used += w + gap
  })
  const lineHeight = fs * 1.5
  let y = bottom - rows.length * lineHeight
  const start = y
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  for (const row of rows) {
    const total = row.reduce((sum, i) => sum + widths[i]! + gap, -gap)
    let x = (chart.width - total) / 2
    for (const i of row) {
      ctx.fillStyle = items[i]!.color
      ctx.beginPath()
      ctx.roundRect(x, y + lineHeight / 2 - fs * 0.4, fs * 0.8, fs * 0.8, fs * 0.2)
      ctx.fill()
      ctx.fillStyle = chart.textColor
      ctx.fillText(items[i]!.label, x + fs * 1.2, y + lineHeight / 2)
      x += widths[i]! + gap
    }
    y += lineHeight
  }
  return start - fs * 0.4
}

function paintAxes(
  ctx: CanvasRenderingContext2D,
  chart: ChartObject,
  top: number,
  bottom: number,
  font: (weight?: number, size?: number) => string,
): void {
  const fs = chart.fontSize
  const stacked = chart.kind === 'bar' && chart.stacked && chart.series.length > 1
  // Stacked bars reach as high as the sum of each category.
  const all = stacked
    ? chart.labels.flatMap((_, i) => {
        const vs = chart.series.map((s) => s.values[i] ?? 0).filter(Number.isFinite)
        return [
          vs.filter((v) => v > 0).reduce((a, b) => a + b, 0),
          vs.filter((v) => v < 0).reduce((a, b) => a + b, 0),
        ]
      })
    : chart.series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const max = Math.max(0, ...all)
  const min = Math.min(0, ...all)
  const up = niceScale(max)
  const down = min < 0 ? niceScale(-min) : { top: 0, step: up.step }
  const step = Math.max(up.step, down.step)
  const hi = Math.ceil(up.top / step) * step
  const lo = -Math.ceil(down.top / step) * step

  ctx.font = font()
  const labelWidth = Math.max(...[lo, hi, step].map((v) => ctx.measureText(formatValue(v)).width))
  const left = fs * 0.6 + labelWidth + fs * 0.5
  const right = chart.width - fs * 0.8
  const plotBottom = bottom - fs * 1.8
  const plotTop = top + fs * 0.5
  const y = (v: number) => plotBottom - ((v - lo) / (hi - lo || 1)) * (plotBottom - plotTop)

  // Value scale and grid.
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(0.5, fs / 14)
  for (let v = lo; v <= hi + step / 2; v += step) {
    ctx.fillStyle = chart.textColor
    ctx.fillText(formatValue(v), left - fs * 0.5, y(v))
    if (chart.grid || v === 0) {
      ctx.strokeStyle = v === 0 ? AXIS_COLOR : GRID_COLOR
      ctx.beginPath()
      ctx.moveTo(left, y(v))
      ctx.lineTo(right, y(v))
      ctx.stroke()
    }
  }

  const n = chart.labels.length
  if (n === 0) return
  const band = (right - left) / n
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  chart.labels.forEach((label, i) => {
    ctx.fillStyle = chart.textColor
    ctx.fillText(label, left + band * (i + 0.5), plotBottom + fs * 0.5, band)
  })

  const series = chart.series
  if (stacked) {
    const barW = band * 0.6
    const pos = chart.labels.map(() => 0)
    const neg = chart.labels.map(() => 0)
    series.forEach((s) => {
      ctx.fillStyle = s.color
      s.values.slice(0, n).forEach((v, i) => {
        if (!Number.isFinite(v) || v === 0) return
        const base = v > 0 ? pos[i]! : neg[i]!
        const top = base + v
        if (v > 0) pos[i] = top
        else neg[i] = top
        const x = left + band * i + (band - barW) / 2
        ctx.fillRect(x, Math.min(y(base), y(top)), barW, Math.abs(y(top) - y(base)))
      })
    })
    if (chart.values) {
      chart.labels.forEach((_, i) => {
        const total = pos[i]! + neg[i]!
        valueLabel(ctx, chart, total, left + band * (i + 0.5), y(pos[i]!) - fs * 0.2, font)
      })
    }
  } else if (chart.kind === 'bar') {
    const inner = band * 0.7
    const barW = inner / Math.max(1, series.length)
    series.forEach((s, k) => {
      ctx.fillStyle = s.color
      s.values.slice(0, n).forEach((v, i) => {
        if (!Number.isFinite(v)) return
        const x = left + band * i + (band - inner) / 2 + barW * k
        const y0 = y(0)
        const y1 = y(v)
        ctx.beginPath()
        ctx.roundRect(
          x + barW * 0.06,
          Math.min(y0, y1),
          barW * 0.88,
          Math.abs(y1 - y0),
          Math.min(fs * 0.25, barW * 0.2),
        )
        ctx.fill()
        if (chart.values)
          valueLabel(ctx, chart, v, x + barW / 2, v >= 0 ? y1 - fs * 0.2 : y1 + fs * 1.1, font)
      })
    })
  } else {
    series.forEach((s) => {
      const pts = s.values
        .slice(0, n)
        .map((v, i) => (Number.isFinite(v) ? { x: left + band * (i + 0.5), y: y(v), v } : null))
      ctx.strokeStyle = s.color
      ctx.lineWidth = Math.max(1, fs / 6)
      ctx.lineJoin = 'round'
      ctx.beginPath()
      let started = false
      for (const p of pts) {
        if (!p) {
          started = false
          continue
        }
        if (started) ctx.lineTo(p.x, p.y)
        else ctx.moveTo(p.x, p.y)
        started = true
      }
      ctx.stroke()
      ctx.fillStyle = s.color
      for (const p of pts) {
        if (!p) continue
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(1.5, fs / 4), 0, Math.PI * 2)
        ctx.fill()
        if (chart.values) valueLabel(ctx, chart, p.v, p.x, p.y - fs * 0.5, font)
      }
    })
  }
  if (chart.average) paintAverages(ctx, chart, left, right, y)
}

/** A dashed line across the plot at the average of each series. */
function paintAverages(
  ctx: CanvasRenderingContext2D,
  chart: ChartObject,
  left: number,
  right: number,
  y: (v: number) => number,
): void {
  ctx.save()
  ctx.setLineDash([chart.fontSize * 0.5, chart.fontSize * 0.35])
  ctx.lineWidth = Math.max(0.75, chart.fontSize / 10)
  for (const s of chart.series) {
    const values = s.values.slice(0, chart.labels.length).filter(Number.isFinite)
    if (values.length === 0) continue
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    ctx.strokeStyle = s.color
    ctx.beginPath()
    ctx.moveTo(left, y(avg))
    ctx.lineTo(right, y(avg))
    ctx.stroke()
    ctx.font = `600 ${chart.fontSize * 0.8}px ${FONT_STACKS.sans}`
    ctx.fillStyle = s.color
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`ø ${formatValue(avg)}`, right, y(avg) - 2)
  }
  ctx.restore()
}

function valueLabel(
  ctx: CanvasRenderingContext2D,
  chart: ChartObject,
  v: number,
  x: number,
  y: number,
  font: (weight?: number, size?: number) => string,
): void {
  ctx.save()
  ctx.font = font(600, chart.fontSize * 0.85)
  ctx.fillStyle = chart.textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(formatValue(v), x, y)
  ctx.restore()
}

function paintPie(
  ctx: CanvasRenderingContext2D,
  chart: ChartObject,
  top: number,
  bottom: number,
  font: (weight?: number, size?: number) => string,
): void {
  const values = (chart.series[0]?.values ?? []).slice(0, chart.labels.length)
  const total = values.reduce((sum, v) => sum + (v > 0 ? v : 0), 0)
  const cx = chart.width / 2
  const cy = (top + bottom) / 2
  const r = Math.max(4, Math.min(chart.width / 2 - chart.fontSize, (bottom - top) / 2))
  if (total <= 0) {
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    return
  }
  let angle = -Math.PI / 2
  values.forEach((v, i) => {
    if (!(v > 0)) return
    const sweep = (v / total) * Math.PI * 2
    ctx.fillStyle = sliceColor(chart, i)
    ctx.beginPath()
    if (chart.kind === 'donut') {
      ctx.arc(cx, cy, r, angle, angle + sweep)
      ctx.arc(cx, cy, r * 0.55, angle + sweep, angle, true)
    } else {
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + sweep)
    }
    ctx.closePath()
    ctx.fill()
    // A thin paper-colored gap between slices.
    ctx.strokeStyle = '#fffcf7'
    ctx.lineWidth = Math.max(0.75, chart.fontSize / 10)
    ctx.stroke()
    angle += sweep
  })
  if (chart.values) {
    angle = -Math.PI / 2
    values.forEach((v) => {
      if (!(v > 0)) return
      const sweep = (v / total) * Math.PI * 2
      const mid = angle + sweep / 2
      const at = chart.kind === 'donut' ? r * 0.78 : r * 0.62
      ctx.save()
      ctx.font = font(700, chart.fontSize * 0.9)
      ctx.fillStyle = '#fffcf7'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (sweep > 0.25) {
        ctx.fillText(
          `${Math.round((v / total) * 100)}%`,
          cx + Math.cos(mid) * at,
          cy + Math.sin(mid) * at,
        )
      }
      ctx.restore()
      angle += sweep
    })
  }
}
