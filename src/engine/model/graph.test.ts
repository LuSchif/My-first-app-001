import { describe, expect, it } from 'vitest'
import { graphFromAxes, scaleGraph, snapAxesToGrid, tickSize } from './graph.ts'

const axes = {
  origin: { x: 101.3, y: 302.6 },
  left: 99,
  right: 307.4,
  top: 140.2,
  bottom: 305,
  depth: null,
  headSize: 9,
}

describe('graphs', () => {
  it('snaps axes drawn on grid paper onto its lines', () => {
    const grid = { size: 14.17, offX: 3.2, offY: 6.1 }
    const snapped = snapAxesToGrid(axes, grid)
    const onLine = (v: number, off: number) => {
      const k = (v - off) / grid.size
      return Math.abs(k - Math.round(k)) < 1e-9
    }
    expect(onLine(snapped.origin.x, grid.offX)).toBe(true)
    expect(onLine(snapped.origin.y, grid.offY)).toBe(true)
    expect(onLine(snapped.right, grid.offX)).toBe(true)
    expect(onLine(snapped.top, grid.offY)).toBe(true)
    // The ends stay where they were drawn, give or take half a square.
    expect(Math.abs(snapped.right - axes.right)).toBeLessThan(grid.size)
    // A graph on grid paper starts with a tick on every square.
    const graph = graphFromAxes('g', 'l', snapped, { color: '#000', width: 2 }, grid.size)
    expect(graph.ticks.x).toBe(grid.size)
  })

  it('keeps tick sizes per axis, and scales them with the graph', () => {
    const graph = graphFromAxes('g', 'l', axes, { color: '#000', width: 2 })
    // Without own sizes, ticks are as thick as the axes.
    expect(tickSize(graph, 'x').width).toBe(2)
    const sized = {
      ...graph,
      tickSizes: {
        x: { length: 10, width: 1 },
        y: { length: 6, width: 3 },
        z: { length: 8, width: 2 },
      },
    }
    const bigger = scaleGraph(sized, 2)
    expect(tickSize(bigger, 'x')).toEqual({ length: 20, width: 2 })
    expect(tickSize(bigger, 'y')).toEqual({ length: 12, width: 6 })
  })
})
