import { describe, expect, it } from 'vitest'
import { directionFactor, flattenStroke, nibWidthAt, pressureFactor } from './nib.ts'
import { eraseFromStroke } from './erase.ts'

describe('fountain pen nib', () => {
  it('draws wider across the nib than along it', () => {
    // The nib edge rises to the right, so a stroke falling to the right crosses it.
    expect(directionFactor(1, 1)).toBeGreaterThan(directionFactor(1, -1) + 0.4)
  })

  it('widens with pressure', () => {
    expect(pressureFactor(0.9)).toBeGreaterThan(pressureFactor(0.5))
    expect(pressureFactor(0.5)).toBeGreaterThan(pressureFactor(0.1))
  })

  it('keeps earlier widths while the stroke grows', () => {
    const points = [0, 0, 5, 5, 10, 8, 15, 6, 20, 0]
    const pressures = [0.5, 0.6, 0.7, 0.6, 0.5]
    const early = nibWidthAt(points.slice(0, 8), pressures, 2, 3)
    expect(nibWidthAt(points, pressures, 2, 3)).toBe(early)
  })

  it('flattens the curve with interpolated widths', () => {
    const flat = flattenStroke([0, 0, 10, 0, 20, 0], [1, 3, 5])
    expect(flat.length % 3).toBe(0)
    expect(flat[2]).toBe(1)
    expect(flat[flat.length - 1]).toBe(5)
  })

  it('erasing keeps each remaining width', () => {
    const pieces = eraseFromStroke([0, 0, 10, 0, 20, 0, 30, 0, 40, 0], [1, 2, 3, 4, 5], 20, 0, 3)
    expect(pieces).toHaveLength(2)
    for (const p of pieces!) expect(p.widths).toHaveLength(p.points.length / 2)
    expect(pieces![1]!.widths!.at(-1)).toBe(5)
  })
})
