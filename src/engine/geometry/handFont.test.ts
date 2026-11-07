import { describe, expect, it } from 'vitest'
import cursive from '../fonts/cursive.json'
import { writeHandwriting, type HandFont } from './handFont.ts'

const font = cursive as unknown as HandFont

describe('writeHandwriting', () => {
  it('writes the same hand for the same seed, and a slightly different one otherwise', () => {
    const a = writeHandwriting('Hallo', font, { x: 0, y: 0, width: 500, size: 20, seed: 3 })
    const b = writeHandwriting('Hallo', font, { x: 0, y: 0, width: 500, size: 20, seed: 3 })
    const c = writeHandwriting('Hallo', font, { x: 0, y: 0, width: 500, size: 20, seed: 4 })
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a.length).toBeGreaterThan(0)
  })

  it('wraps at the width and keeps line breaks', () => {
    const lowest = (lines: number[][]) =>
      Math.max(...lines.flatMap((p) => p.filter((_, i) => i % 2 === 1)))
    const one = writeHandwriting('Liebe Grüße', font, { x: 0, y: 0, width: 1000, size: 20 })
    const wrapped = writeHandwriting('Liebe Grüße', font, { x: 0, y: 0, width: 60, size: 20 })
    const broken = writeHandwriting('Liebe\nGrüße', font, { x: 0, y: 0, width: 1000, size: 20 })
    expect(lowest(wrapped)).toBeGreaterThan(lowest(one) + 15)
    expect(lowest(broken)).toBeGreaterThan(lowest(one) + 15)
    // Every point stays near the text's place.
    for (const p of wrapped) for (let i = 0; i < p.length; i += 2) expect(p[i]).toBeLessThan(140)
  })

  it('writes characters the font lacks as near ones', () => {
    const quote = writeHandwriting('„a…', font, { x: 0, y: 0, width: 500, size: 20 })
    expect(quote.length).toBeGreaterThan(3)
  })
})
