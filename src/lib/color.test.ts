import { describe, expect, it } from 'vitest'
import { hexToHsv, hsvToHex } from './color.ts'

describe('hsv', () => {
  it('converts the primaries', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00')
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe('#000080')
  })

  it('round-trips brand colors', () => {
    for (const hex of ['#3e2d25', '#b98b65', '#f7f2ea', '#4a80c0', '#808080']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex)
    }
  })
})
