import { enterBox } from '../geometry/box.ts'
import type { TableObject } from '../model/types.ts'
import { strokeBoxOutline } from './outline.ts'
import { FONT_STACKS } from './text.ts'

/** Space between a cell's border and its text, in points. */
const CELL_PAD = 4

/** Left edges of the columns and top edges of the rows, plus the far edge. */
export function tableEdges(sizes: readonly number[]): number[] {
  const out = [0]
  for (const size of sizes) out.push(out[out.length - 1]! + size)
  return out
}

/** The cell at a point in the table's own frame (from its top-left corner), if any. */
export function cellAt(
  table: TableObject,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const cols = tableEdges(table.columns)
  const rows = tableEdges(table.rows)
  const col = cols.findIndex((edge, i) => i > 0 && x <= edge) - 1
  const row = rows.findIndex((edge, i) => i > 0 && y <= edge) - 1
  if (x < 0 || y < 0 || col < 0 || row < 0) return null
  return { row, col }
}

export function paintTable(ctx: CanvasRenderingContext2D, table: TableObject): void {
  const { style } = table
  const cols = tableEdges(table.columns)
  const rows = tableEdges(table.rows)
  ctx.save()
  enterBox(ctx, table)

  if (style.header && table.rows.length > 0) {
    ctx.fillStyle = style.headerFill
    ctx.fillRect(0, 0, table.width, table.rows[0]!)
  }

  // Cell text, wrapped to the cell and cut off at its border.
  ctx.fillStyle = style.textColor
  ctx.textBaseline = 'top'
  table.cells.forEach((row, r) => {
    const bold = style.header && r === 0
    ctx.font = `${bold ? 700 : 400} ${style.fontSize}px ${FONT_STACKS[style.font]}`
    row.forEach((text, c) => {
      if (!text || c >= table.columns.length || r >= table.rows.length) return
      const x = cols[c]!
      const y = rows[r]!
      const w = table.columns[c]!
      const h = table.rows[r]!
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()
      const lines = wrap(ctx, text, w - CELL_PAD * 2)
      const lineHeight = style.fontSize * 1.25
      const total = lines.length * lineHeight
      // Centered vertically when it fits, from the top when it does not.
      let ty = y + Math.max(CELL_PAD, (h - total) / 2)
      for (const line of lines) {
        ctx.fillText(line, x + CELL_PAD, ty + (lineHeight - style.fontSize) / 2)
        ty += lineHeight
      }
      ctx.restore()
    })
  })

  ctx.strokeStyle = style.lineColor
  ctx.lineWidth = style.lineWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const x of cols) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, table.height)
  }
  for (const y of rows) {
    ctx.moveTo(0, y)
    ctx.lineTo(table.width, y)
  }
  ctx.stroke()

  // The table's own frame line is its edge.
  if (table.outline) {
    strokeBoxOutline(ctx, table.width, table.height, table.outline, style.lineWidth / 2)
  }
  ctx.restore()
}

/** Splits text into lines that fit `width`, at spaces where possible. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= width || !line) line = next
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}
