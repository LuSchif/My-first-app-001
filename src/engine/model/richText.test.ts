import { describe, expect, it } from 'vitest'
import { editText, formatAll, formatRange, scaleText, styleAt, textRuns } from './richText.ts'
import type { TextObject } from './types.ts'

const box: TextObject = {
  id: 't',
  type: 'text',
  layerId: 'l',
  x: 0,
  y: 0,
  width: 200,
  rotation: 0,
  text: 'Hello brave world',
  style: {
    font: 'sans',
    size: 16,
    color: '#000000',
    opacity: 1,
    bold: false,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.35,
  },
}

describe('text with parts in other styles', () => {
  it('formats only the selected characters', () => {
    const bold = formatRange(box, 6, 11, { bold: true, size: 24 })
    expect(bold.spans).toEqual([{ start: 6, end: 11, style: { bold: true, size: 24 } }])
    expect(styleAt(bold, 0).bold).toBe(false)
    expect(styleAt(bold, 7)).toMatchObject({ bold: true, size: 24 })
    expect(textRuns(bold).map((r) => r.text)).toEqual(['Hello ', 'brave', ' world'])
  })

  it('merges and drops spans that match the box style', () => {
    let t = formatRange(box, 0, 5, { italic: true })
    t = formatRange(t, 5, 11, { italic: true })
    expect(t.spans).toEqual([{ start: 0, end: 11, style: { italic: true } }])
    t = formatRange(t, 0, 11, { italic: false })
    expect(t.spans).toBeUndefined()
  })

  it('moves spans with edits; new letters take the style before them', () => {
    const t = formatRange(box, 6, 11, { bold: true })
    const typed = editText(t, 'Hello braveee world')
    expect(typed.spans).toEqual([{ start: 6, end: 13, style: { bold: true } }])
    const cut = editText(typed, 'Hello world')
    expect(cut.spans).toBeUndefined()
    const before = editText(t, 'Oh, Hello brave world')
    expect(before.spans).toEqual([{ start: 10, end: 15, style: { bold: true } }])
  })

  it('applies box changes to formatted parts too, and scales all sizes', () => {
    const t = formatRange(box, 6, 11, { color: '#ff0000', size: 20 })
    const all = formatAll(t, { color: '#00ff00' })
    expect(all.style.color).toBe('#00ff00')
    expect(all.spans).toEqual([{ start: 6, end: 11, style: { size: 20 } }])
    const scaled = scaleText(all, 2)
    expect(scaled.style.size).toBe(32)
    expect(scaled.spans?.[0]?.style.size).toBe(40)
  })
})
