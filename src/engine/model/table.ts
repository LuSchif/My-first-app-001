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
