import { describe, expect, it } from 'vitest'
import type { StrokeObject } from '../model/types.ts'
import { applySuggestion, cleanDrawingFor, magicFor, suggestFor } from './suggestions.ts'

const stroke = (id: string, points: number[], color = '#3e2d25'): StrokeObject => ({
  id,
  type: 'stroke',
  layerId: 'l',
  tool: 'pen',
  color,
  width: 2,
  opacity: 1,
  points,
})

const circle = (cx: number, cy: number, r: number) =>
  Array.from({ length: 61 }, (_, i) => {
    const t = (i / 60) * Math.PI * 2
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)]
  }).flat()

// Zig-zag coloring inside a box of the given size around (cx, cy).
const scribble = (cx: number, cy: number, half: number) =>
  Array.from({ length: 40 }, (_, i) => [
    cx - half + (i % 2) * half * 2,
    cy - half + (i / 39) * half * 2,
  ]).flat()

describe('suggestions', () => {
  it('offers to fill a circle that is being colored in, below its outline', () => {
    const outline = stroke('outline', circle(200, 200, 60))
    const red = stroke('red', scribble(200, 200, 30), '#c4473a')
    const suggestion = suggestFor([outline, red], red)
    expect(suggestion?.kind).toBe('fill')
    const after = applySuggestion([outline, red], suggestion!, 'l', () => 'fill')
    expect(after.map((o) => o.id)).toEqual(['fill', 'outline'])
    expect(after[0]).toMatchObject({ type: 'fill', color: '#c4473a' })
  })

  it('offers a clean shape for a large drawn circle, but not for small handwriting', () => {
    const big = stroke('big', circle(200, 200, 60))
    expect(suggestFor([big], big)).toMatchObject({ kind: 'shape', shape: { kind: 'circle' } })
    const letter = stroke('o', circle(200, 200, 8))
    expect(suggestFor([letter], letter)).toBeNull()
  })

  it('offers a square drawn as four sides as one shape', () => {
    const sides = [
      stroke('a', [100, 100, 150, 101, 200, 100]),
      stroke('b', [201, 102, 200, 150, 199, 200]),
      stroke('c', [198, 201, 150, 200, 101, 199]),
      stroke('d', [100, 198, 101, 150, 102, 103]),
    ]
    const suggestion = suggestFor(sides, sides[3]!)
    expect(suggestion).toMatchObject({ kind: 'shape', shape: { kind: 'square' } })
    const after = applySuggestion(sides, suggestion!, 'l', () => 'x')
    expect(after.map((o) => o.id)).toEqual(['a'])
  })

  it('replaces the drawn stroke with the clean shape', () => {
    const big = stroke('big', circle(200, 200, 60))
    const after = applySuggestion([big], suggestFor([big], big)!, 'l', () => 'x')
    expect(after[0]).toMatchObject({ id: 'big', closed: true })
  })

  it('magic pen: fills a shape that is colored in, at once', () => {
    const outline = stroke('outline', circle(200, 200, 60))
    const red = stroke('red', scribble(200, 200, 30), '#c4473a')
    const after = magicFor([outline, red], red)
    expect(after.objects.map((o) => o.type)).toEqual(['fill', 'stroke'])
  })

  it('magic pen: smooths a wavy line and keeps its size', () => {
    let seed = 3
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 3
    const wave = Array.from({ length: 80 }, (_, i) => [
      100 + i * 4 + rnd(),
      200 + Math.sin(i / 8) * 40 + rnd(),
    ]).flat()
    const drawn = stroke('w', wave)
    const after = magicFor([drawn], drawn).objects[0] as StrokeObject
    expect(after.id).toBe('w')
    expect(after.straight).toBe(true)
    const ys = after.points.filter((_, i) => i % 2 === 1)
    expect(Math.max(...ys)).toBeGreaterThan(234)
    expect(Math.min(...ys)).toBeLessThan(166)
  })

  it('makes graph axes clean, with heads right and top', () => {
    const axes = stroke('l', [100, 50, 100, 150, 100, 250, 210, 250, 320, 250])
    const head = stroke('h', [305, 238, 321, 250, 305, 262])
    const clean = cleanDrawingFor([axes, head], head)
    expect(clean?.label).toBe('Graph')
    expect(clean?.replaces).toEqual(['l', 'h'])
    expect(clean?.strokes).toHaveLength(4)
  })
})
