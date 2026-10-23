import { describe, expect, it } from 'vitest'
import { fillBaseColor, fillToCss, parseHex, prefersLightText } from './fill.ts'

describe('fillToCss', () => {
  it('returns the color of a solid fill', () => {
    expect(fillToCss({ type: 'solid', color: '#b98b65' })).toBe('#b98b65')
  })

  it('sorts and clamps linear gradient stops', () => {
    const css = fillToCss({
      type: 'linear',
      angle: 135,
      stops: [
        { offset: 1.2, color: '#3e2d25' },
        { offset: 0, color: '#f7f2ea' },
      ],
    })
    expect(css).toBe('linear-gradient(135deg, #f7f2ea 0%, #3e2d25 100%)')
  })

  it('builds radial gradients', () => {
    const css = fillToCss({
      type: 'radial',
      stops: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.5, color: '#000000' },
      ],
    })
    expect(css).toBe('radial-gradient(circle at 50% 50%, #ffffff 0%, #000000 50%)')
  })
})

describe('fillBaseColor', () => {
  it('uses the first stop of a gradient', () => {
    const fill = {
      type: 'linear' as const,
      angle: 0,
      stops: [
        { offset: 0.8, color: '#222222' },
        { offset: 0.1, color: '#111111' },
      ],
    }
    expect(fillBaseColor(fill)).toBe('#111111')
  })
})

describe('parseHex', () => {
  it('accepts short and long forms with or without #', () => {
    expect(parseHex('abc')).toBe('#aabbcc')
    expect(parseHex(' #B98B65 ')).toBe('#b98b65')
  })

  it('rejects invalid input', () => {
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('zzzzzz')).toBeNull()
  })
})

describe('prefersLightText', () => {
  it('picks light text on dark fills and dark text on light fills', () => {
    expect(prefersLightText({ type: 'solid', color: '#3e2d25' })).toBe(true)
    expect(prefersLightText({ type: 'solid', color: '#f7f2ea' })).toBe(false)
  })
})
