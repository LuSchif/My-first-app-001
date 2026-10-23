import { describe, expect, it } from 'vitest'
import { makePdf } from './pdf.ts'

describe('makePdf', () => {
  it('writes a valid cross-reference table', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])
    const blob = makePdf(
      [
        { jpeg, width: 2, height: 3 },
        { jpeg, width: 2, height: 3 },
      ],
      595,
      842,
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const text = new TextDecoder('latin1').decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('/Count 2')
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    // Every listed offset points at the start of its object.
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n/g)].map((m) =>
      Number(m[1]),
    )
    entries.forEach((offset, i) =>
      expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true),
    )
  })
})
