import type { BoxFrame, Id, TableObject, TableStyle } from './types.ts'

export const DEFAULT_TABLE_STYLE: TableStyle = {
  lineColor: '#3e2d25',
  lineWidth: 1.25,
  header: true,
  headerFill: '#efe4d6',
  textColor: '#3e2d25',
  fontSize: 11,
  font: 'sans',
}

/** A new table with evenly sized cells filling the frame. */
export function createTable(
  id: Id,
  layerId: Id,
  frame: BoxFrame,
  rowCount: number,
  colCount: number,
  style: TableStyle = DEFAULT_TABLE_STYLE,
): TableObject {
  return {
    id,
    type: 'table',
    layerId,
    ...frame,
    columns: Array.from({ length: colCount }, () => frame.width / colCount),
    rows: Array.from({ length: rowCount }, () => frame.height / rowCount),
    cells: Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => '')),
    style,
  }
}

/** A table that keeps the spacing of hand-drawn grid lines. */
export function tableFromGrid(
  id: Id,
  layerId: Id,
  xs: readonly number[],
  ys: readonly number[],
  style: TableStyle,
): TableObject {
  const columns = xs.slice(1).map((x, i) => x - xs[i]!)
  const rows = ys.slice(1).map((y, i) => y - ys[i]!)
  return {
    id,
    type: 'table',
    layerId,
    x: xs[0]!,
    y: ys[0]!,
    width: xs[xs.length - 1]! - xs[0]!,
    height: ys[ys.length - 1]! - ys[0]!,
    rotation: 0,
    columns,
    rows,
    cells: rows.map(() => columns.map(() => '')),
    style: { ...style, header: false },
  }
}

/**
 * Grows the frame by `dw` × `dh` toward its right and bottom edges, keeping the top-left corner
 * where it is on the page, also when the table is rotated.
 */
function grow(t: TableObject, dw: number, dh: number): BoxFrame {
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  // The center moves by half the growth, along the table's own axes.
  const cx = t.x + t.width / 2 + (dw / 2) * cos - (dh / 2) * sin
  const cy = t.y + t.height / 2 + (dw / 2) * sin + (dh / 2) * cos
  const width = t.width + dw
  const height = t.height + dh
  return { x: cx - width / 2, y: cy - height / 2, width, height, rotation: t.rotation }
}

/** Adds a column after `after` (default: at the right), as wide as that column. */
export function addColumn(t: TableObject, after = t.columns.length - 1): TableObject {
  const w = t.columns[after] ?? t.columns[t.columns.length - 1] ?? 40
  const columns = [...t.columns]
  columns.splice(after + 1, 0, w)
  const cells = t.cells.map((row) => {
    const next = [...row]
    next.splice(after + 1, 0, '')
    return next
  })
  return { ...t, ...grow(t, w, 0), columns, cells }
}

/** Adds a row after `after` (default: at the bottom), as tall as that row. */
export function addRow(t: TableObject, after = t.rows.length - 1): TableObject {
  const h = t.rows[after] ?? t.rows[t.rows.length - 1] ?? 20
  const rows = [...t.rows]
  rows.splice(after + 1, 0, h)
  const cells = [...t.cells]
  cells.splice(
    after + 1,
    0,
    t.columns.map(() => ''),
  )
  return { ...t, ...grow(t, 0, h), rows, cells }
}

export function removeColumn(t: TableObject, index: number): TableObject {
  if (t.columns.length <= 1) return t
  const w = t.columns[index]!
  return {
    ...t,
    ...grow(t, -w, 0),
    columns: t.columns.filter((_, i) => i !== index),
    cells: t.cells.map((row) => row.filter((_, i) => i !== index)),
  }
}

export function removeRow(t: TableObject, index: number): TableObject {
  if (t.rows.length <= 1) return t
  const h = t.rows[index]!
  return {
    ...t,
    ...grow(t, 0, -h),
    rows: t.rows.filter((_, i) => i !== index),
    cells: t.cells.filter((_, i) => i !== index),
  }
}

export function setCell(t: TableObject, row: number, col: number, text: string): TableObject {
  const cells = t.cells.map((r, i) => (i === row ? r.map((c, j) => (j === col ? text : c)) : r))
  return { ...t, cells }
}

/** Room kept free between a table and the page edge, in points. */
const PAGE_MARGIN = 12

/**
 * Keeps a straight table on the page: when it reaches past the right or bottom edge, its columns
 * or rows shrink together, keeping their proportions, until it fits.
 */
export function fitToPage(t: TableObject, pageWidth: number, pageHeight: number): TableObject {
  if (Math.abs(t.rotation) > 1e-6) return t
  const roomX = pageWidth - PAGE_MARGIN - t.x
  const roomY = pageHeight - PAGE_MARGIN - t.y
  let next = t
  if (t.width > roomX && roomX > 20) {
    const k = roomX / t.width
    next = { ...next, columns: next.columns.map((w) => w * k), width: roomX }
  }
  if (t.height > roomY && roomY > 20) {
    const k = roomY / t.height
    next = { ...next, rows: next.rows.map((h) => h * k), height: roomY }
  }
  return next
}

/** A number written in a cell ("1,5", "2.5 €", "40%"), or null for text. */
export function cellNumber(text: string): number | null {
  const cleaned = text.replace(/[\s€$%]/g, '').replace(',', '.')
  if (cleaned === '' || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

function formatNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
}

/** Adds a row below that sums up (or averages) every column holding numbers. */
export function addSummaryRow(t: TableObject, kind: 'sum' | 'average'): TableObject {
  const body = t.cells.slice(t.style.header ? 1 : 0)
  const values = t.columns.map((_, c) => {
    const numbers = body.map((row) => cellNumber(row[c] ?? '')).filter((v) => v !== null)
    if (numbers.length === 0) return ''
    const sum = numbers.reduce((a, b) => a + b, 0)
    return formatNumber(kind === 'sum' ? sum : sum / numbers.length)
  })
  // A label in the first column, unless that column holds numbers itself.
  if (values[0] === '') values[0] = kind === 'sum' ? 'Total' : 'Average'
  const grown = addRow(t)
  return { ...grown, cells: [...grown.cells.slice(0, -1), values] }
}

/** Whether the table holds numbers a chart could show. */
export function hasChartData(t: TableObject): boolean {
  return t.cells.some((row) => row.some((c) => cellNumber(c) !== null))
}

/**
 * The data of a table for a chart: the first column names the categories, every other column
 * holding numbers becomes a series, named by the first row if that holds no numbers. A table
 * with a single row of numbers is read across instead.
 */
export function tableChartData(t: TableObject): {
  labels: string[]
  series: { name: string; values: number[] }[]
} {
  // A first row without numbers names the series, header row or not.
  const numeric = (row: string[]) => row.some((c) => cellNumber(c) !== null)
  const first = t.cells[0] ?? []
  const header =
    t.style.header || (!numeric(first) && t.cells.slice(1).some(numeric)) ? first : undefined
  // Totals and averages added with the table tools are not data of their own.
  const body = t.cells
    .slice(header ? 1 : 0)
    .filter((row) => row[0] !== 'Total' && row[0] !== 'Average')
  const firstIsLabels = body.some((row) => (row[0] ?? '') !== '' && cellNumber(row[0]!) === null)
  const labels = body.map((row, i) => (firstIsLabels ? row[0] || `${i + 1}` : `${i + 1}`))
  const series = t.columns.flatMap((_, c) => {
    if (firstIsLabels && c === 0) return []
    const values = body.map((row) => cellNumber(row[c] ?? '') ?? 0)
    if (!body.some((row) => cellNumber(row[c] ?? '') !== null)) return []
    return [{ name: header?.[c] || `Column ${c + 1}`, values }]
  })
  // A table written across (names in the first row, one row of numbers under them) has one
  // value per column: its columns are the categories, not series of one value each.
  if (labels.length === 1 && series.length > 1) {
    return {
      labels: series.map((s) => s.name),
      series: [
        {
          name: firstIsLabels ? labels[0]! : 'Values',
          values: series.map((s) => s.values[0] ?? 0),
        },
      ],
    }
  }
  return { labels, series }
}
