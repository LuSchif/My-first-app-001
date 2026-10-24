import { describe, expect, it } from 'vitest'
import { detectTable, type TableSource } from './tableDetect.ts'

let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
/** A slightly shaky hand-drawn line. */
const line = (id: string, x0: number, y0: number, x1: number, y1: number): TableSource => ({
  id,
  points: Array.from({ length: 30 }, (_, i) => {
    const t = i / 29
    return [x0 + (x1 - x0) * t + (rnd() - 0.5) * 1.5, y0 + (y1 - y0) * t + (rnd() - 0.5) * 1.5]
  }).flat(),
})

describe('detectTable', () => {
  it('finds a grid of single lines and keeps the drawn spacing', () => {
    const sources = [
      line('t', 100, 100, 400, 101),
      line('m', 101, 140, 399, 139),
      line('b', 100, 230, 401, 231),
      line('l', 100, 99, 101, 231),
      line('c', 180, 100, 181, 230),
      line('r', 400, 100, 399, 232),
    ]
    const table = detectTable(sources, 'r')!
    expect(table.ids.sort()).toEqual(['b', 'c', 'l', 'm', 'r', 't'])
    const near = (got: number[], want: number[]) =>
      expect(got.every((v, i) => Math.abs(v - want[i]!) < 1.5) && got.length === want.length).toBe(
        true,
      )
    near(table.xs, [100, 180.5, 400])
    near(table.ys, [100.5, 139.5, 230.5])
  })

  it('accepts a frame drawn in one go with dividers', () => {
    const frame: TableSource = {
      id: 'frame',
      points: [
        ...line('', 50, 50, 250, 50).points,
        ...line('', 250, 50, 250, 150).points,
        ...line('', 250, 150, 50, 150).points,
        ...line('', 50, 150, 50, 50).points,
      ],
    }
    const table = detectTable([frame, line('d', 150, 50, 150, 150)], 'd')!
    expect(table.xs.map(Math.round)).toEqual([50, 150, 250])
    expect(table.ys).toHaveLength(2)
  })

  it('finds an open table: a header line with column dividers, as drawn by hand', () => {
    const sources = [
      line('h', 735, 715, 1005, 712),
      line('a', 795, 665, 790, 880),
      line('b', 912, 668, 902, 852),
      line('c', 988, 662, 980, 845),
    ]
    const table = detectTable(sources, 'c')!
    expect(table).not.toBeNull()
    // Columns: the strip before the first divider, two between them; the 20 pt rest at the right
    // is too thin to be a column of its own.
    expect(table.xs).toHaveLength(4)
    expect(table.ys).toHaveLength(3)
    expect(Math.round(table.ys[1]!)).toBeGreaterThan(705)
  })

  it('ignores a single rectangle, a cross and handwriting', () => {
    const rect = [
      line('t', 0, 0, 100, 0),
      line('b', 0, 60, 100, 60),
      line('l', 0, 0, 0, 60),
      line('r', 100, 0, 100, 60),
    ]
    expect(detectTable(rect, 'r')).toBeNull()
    expect(detectTable([line('h', 0, 50, 100, 50), line('v', 50, 0, 50, 100)], 'v')).toBeNull()
    const scribble: TableSource = {
      id: 's',
      points: Array.from({ length: 40 }, (_, i) => [i * 4, Math.sin(i) * 10]).flat(),
    }
    expect(detectTable([...rect, scribble], 's')).toBeNull()
  })
})
