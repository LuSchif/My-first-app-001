import { describe, expect, it } from 'vitest'
import { MUSIC_STAVES } from '../editor/suggestions.ts'
import { clefStrokes, detectClef, type ClefKind, type DrawnStroke } from './clefs.ts'
import { flattenStroke } from './nib.ts'

const S = MUSIC_STAVES
const g = S.gap

/** A clean clef turned into wobbly hand-drawn strokes, a little larger than engraved. */
function handDrawn(kind: ClefKind, staff: number, scale = 1.15, seed = 3): DrawnStroke[] {
  let r = seed
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5) * 2
  const top = S.top + staff * S.pitch
  const middle = top + 2 * g
  return clefStrokes(kind, 200, top, g, 1.5).map((c) => {
    if (c.points.length === 2) {
      // A dot is a tiny scribble.
      const [x, y] = c.points as [number, number]
      return { points: [x, y, x + 1.2, y + 0.8, x + 0.4, y + 1.5] }
    }
    const flat = flattenStroke(c.points, c.widths)
    const points: number[] = []
    for (let i = 0; i < flat.length; i += 9) {
      points.push(
        200 + (flat[i]! - 200) * scale + rnd() * 0.6,
        middle + (flat[i + 1]! - middle) * scale + rnd() * 0.6,
      )
    }
    return { points }
  })
}

describe('clef recognition', () => {
  it.each(['treble', 'bass', 'alto', 'tenor'] as const)('recognizes a drawn %s clef', (kind) => {
    for (const staff of [0, 3]) {
      const found = detectClef(handDrawn(kind, staff), S)
      expect(found?.kind).toBe(kind)
      expect(found?.staffTop).toBe(S.top + staff * S.pitch)
    }
  })

  it('needs both dots for a bass clef', () => {
    const bass = handDrawn('bass', 1)
    expect(detectClef(bass.slice(0, 2), S)).toBeNull()
  })

  it('leaves notes and small writing alone', () => {
    const top = S.top + S.pitch
    // A note: a small filled head and a stem.
    const head = {
      points: [100, top + 14, 104, top + 12, 108, top + 14, 104, top + 16, 100, top + 14],
    }
    const stem = { points: [108, top + 14, 108, top - 6] }
    expect(detectClef([head, stem], S)).toBeNull()
    const circle = {
      points: Array.from({ length: 40 }, (_, i) => [
        150 + 12 * Math.cos(i / 6),
        top + 14 + 12 * Math.sin(i / 6),
      ]).flat(),
    }
    expect(detectClef([circle], S)).toBeNull()
  })

  it('draws clean clefs with thick and thin lines', () => {
    const treble = clefStrokes('treble', 100, S.top, g, 1.5)
    const widths = treble[0]!.widths
    expect(Math.max(...widths)).toBeGreaterThan(Math.min(...widths) * 1.8)
  })
})
