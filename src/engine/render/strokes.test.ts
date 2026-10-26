import { describe, expect, it } from 'vitest'
import { fadeToWhite, inkAlpha, inkBlend, inkColor } from './strokes.ts'

describe('highlighter ink', () => {
  it('is painted opaque in its color faded by its opacity, with darken', () => {
    const marker = { tool: 'highlighter', color: '#f2cf4a', opacity: 0.45 }
    expect(inkColor(marker)).toBe(fadeToWhite('#f2cf4a', 0.45))
    expect(inkAlpha(marker)).toBe(1)
    expect(inkBlend(marker)).toBe('darken')
  })

  it('fades a color toward white', () => {
    expect(fadeToWhite('#000000', 1)).toBe('#000000')
    expect(fadeToWhite('#000000', 0)).toBe('#ffffff')
    expect(fadeToWhite('#ff0000', 0.5)).toBe('#ff8080')
  })

  it('leaves pens as they are', () => {
    const pen = { tool: 'pen', color: '#3e2d25', opacity: 0.6 }
    expect(inkColor(pen)).toBe('#3e2d25')
    expect(inkAlpha(pen)).toBe(0.6)
    expect(inkBlend(pen)).toBe('source-over')
  })
})
