import { describe, expect, it } from 'vitest'
import {
  addColumn,
  addRow,
  addSummaryRow,
  cellNumber,
  createTable,
  fitToPage,
  removeColumn,
  tableChartData,
  tableFromGrid,
} from './table.ts'

const frame = { x: 10, y: 20, width: 300, height: 90, rotation: 0 }

describe('tables', () => {
  it('extends to the right and below with the same spacing', () => {
    const drawn = tableFromGrid(
      't',
      'l',
      [0, 50, 130],
      [0, 30, 50],
      createTable('x', 'l', frame, 1, 1).style,
    )
    expect(drawn.columns).toEqual([50, 80])
    const wider = addColumn(drawn)
    expect(wider.columns).toEqual([50, 80, 80])
    expect(wider.width).toBe(210)
    expect(wider.x).toBe(0)
    expect(wider.cells[0]).toHaveLength(3)
    const taller = addRow(wider)
    expect(taller.rows).toEqual([30, 20, 20])
    expect(taller.height).toBe(70)
    expect(taller.y).toBe(0)
  })

  it('keeps the top-left corner of a rotated table in place', () => {
    const t = { ...createTable('t', 'l', frame, 2, 2), rotation: Math.PI / 2 }
    const corner = (o: typeof t) => {
      const cx = o.x + o.width / 2
      const cy = o.y + o.height / 2
      const hw = o.width / 2
      const hh = o.height / 2
      return [
        cx + -hw * Math.cos(o.rotation) + hh * Math.sin(o.rotation),
        cy - hw * Math.sin(o.rotation) - hh * Math.cos(o.rotation),
      ]
    }
    const before = corner(t)
    const after = corner(addColumn(t))
    expect(after[0]).toBeCloseTo(before[0]!)
    expect(after[1]).toBeCloseTo(before[1]!)
  })

  it('removes columns but keeps at least one', () => {
    const t = createTable('t', 'l', frame, 2, 2)
    const one = removeColumn(t, 0)
    expect(one.columns).toHaveLength(1)
    expect(removeColumn(one, 0)).toBe(one)
  })
})

describe('table numbers', () => {
  const style = createTable('x', 'l', frame, 1, 1).style
  const filled = () => {
    const t = createTable('t', 'l', frame, 3, 3, { ...style, header: true })
    return {
      ...t,
      cells: [
        ['Name', 'Math', 'Art'],
        ['Ana', '2,5', '4'],
        ['Ben', '3', '1'],
      ],
    }
  }

  it('reads numbers written in cells', () => {
    expect(cellNumber('2,5')).toBe(2.5)
    expect(cellNumber(' 40 %')).toBe(40)
    expect(cellNumber('abc')).toBeNull()
  })

  it('adds a totals row', () => {
    const t = addSummaryRow(filled(), 'sum')
    expect(t.cells.at(-1)).toEqual(['Total', '5.5', '5'])
    expect(t.rows).toHaveLength(4)
  })

  it('turns a table into chart data', () => {
    const data = tableChartData(filled())
    expect(data.labels).toEqual(['Ana', 'Ben'])
    expect(data.series).toEqual([
      { name: 'Math', values: [2.5, 3] },
      { name: 'Art', values: [4, 1] },
    ])
  })

  it('reads the first row as names without a header row, and skips totals', () => {
    const t = addSummaryRow({ ...filled(), style: { ...filled().style, header: false } }, 'sum')
    const data = tableChartData(t)
    expect(data.labels).toEqual(['Ana', 'Ben'])
    expect(data.series[0]!.name).toBe('Math')
  })

  it('shrinks a table that runs off the page', () => {
    const t = { ...createTable('t', 'l', { ...frame, x: 400 }, 2, 4), rotation: 0 }
    const fitted = fitToPage(t, 595, 842)
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(595)
    expect(fitted.columns.reduce((a, b) => a + b, 0)).toBeCloseTo(fitted.width)
  })
})
