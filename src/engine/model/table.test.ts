import { describe, expect, it } from 'vitest'
import { addColumn, addRow, createTable, removeColumn, tableFromGrid } from './table.ts'

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
