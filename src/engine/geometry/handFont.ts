/**
 * Writing text as generated handwriting: single-line fonts (each glyph is a few pen lines,
 * see engine/fonts) laid out like text, with the small irregularities of a hand (a gently
 * wavering baseline, letters slightly turned, sized and spaced unevenly), in smooth lines.
 * The result is lines in page coordinates, to become ordinary pen strokes.
 */

/** A single-line font: glyphs as polylines (x, y, x, y, …; y down, baseline at 0). */
export interface HandFont {
  /** Height of a capital letter, in font units. */
  cap: number
  xHeight: number
  glyphs: Record<string, [advance: number, lines: number[][]]>
}

export interface HandLayout {
  /** Top left of the text, in page points. */
  x: number
  y: number
  /** Lines wrap at this width (points). */
  width: number
  /** Font size in points: capitals are about 0.7 of it, as in type. */
  size: number
  lineHeight?: number
  align?: 'left' | 'center' | 'right'
  /** Turn around (x, y), in radians. */
  rotation?: number
  /** The same seed writes the same hand. */
  seed?: number
}

/** Characters the fonts lack, written as near ones. */
const STAND_IN: Record<string, string> = {
  '„': '"',
  '‚': ',',
  '‘': "'",
  '’': "'",
  '…': '...',
  '§': 'S',
  '\t': ' ',
}

function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function glyphOf(font: HandFont, ch: string): [number, number[][]][] {
  const direct = font.glyphs[ch]
  if (direct) return [direct]
  const stand = STAND_IN[ch]
  if (stand) return [...stand].flatMap((c) => glyphOf(font, c))
  const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (plain !== ch && plain) return [...plain].flatMap((c) => glyphOf(font, c))
  return [font.glyphs['?'] ?? [500, []]]
}

/** Width of a word in font units. */
function wordWidth(font: HandFont, word: string): number {
  return [...word].reduce((w, ch) => w + glyphOf(font, ch).reduce((a, g) => a + g[0], 0), 0)
}

/** The text in lines that fit `width` (in font units); line breaks in the text are kept. */
function wrap(font: HandFont, text: string, width: number): string[] {
  const space = glyphOf(font, ' ')[0]![0]
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    let lineWidth = 0
    for (const word of paragraph.split(/ +/)) {
      const w = wordWidth(font, word)
      if (line && lineWidth + space + w > width) {
        lines.push(line)
        line = word
        lineWidth = w
      } else {
        line = line ? `${line} ${word}` : word
        lineWidth += (lineWidth ? space : 0) + w
      }
    }
    lines.push(line)
  }
  return lines
}

/**
 * Rounds a glyph's corners (Chaikin's corner cutting, twice; the ends stay): the fonts are
 * digitized as short straight pieces, which would otherwise show as kinks and a shaky line.
 * Sharp turns (where the pen goes back, as at the top of an H) stay sharp.
 */
function smooth(points: number[]): number[] {
  // Split at sharp turns, smooth each piece, join again.
  const pieces: number[][] = []
  let piece = [points[0]!, points[1]!]
  for (let i = 2; i + 1 < points.length; i += 2) {
    piece.push(points[i]!, points[i + 1]!)
    if (i + 3 < points.length) {
      const ax = points[i]! - points[i - 2]!
      const ay = points[i + 1]! - points[i - 1]!
      const bx = points[i + 2]! - points[i]!
      const by = points[i + 3]! - points[i + 1]!
      const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)
      if (cos < -0.2) {
        pieces.push(piece)
        piece = [points[i]!, points[i + 1]!]
      }
    }
  }
  pieces.push(piece)
  const out: number[] = []
  for (const part of pieces) {
    const p = cut(part)
    out.push(...(out.length ? p.slice(2) : p))
  }
  return out
}

function cut(points: number[]): number[] {
  let p = points
  for (let pass = 0; pass < 2 && p.length >= 6; pass++) {
    const out = [p[0]!, p[1]!]
    for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i]!
      const y0 = p[i + 1]!
      const x1 = p[i + 2]!
      const y1 = p[i + 3]!
      out.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1)
      out.push(0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)
    }
    out.push(p[p.length - 2]!, p[p.length - 1]!)
    p = out
  }
  return p
}

/** The text written by hand: its pen lines in page coordinates, each x, y, x, y, … */
export function writeHandwriting(text: string, font: HandFont, layout: HandLayout): number[][] {
  const rnd = random(layout.seed ?? 1)
  const jitter = (amount: number) => (rnd() * 2 - 1) * amount
  const size = layout.size
  const scale = (size * 0.7) / font.cap
  const lineHeight = size * (layout.lineHeight ?? 1.45)
  const lines = wrap(font, text, Math.max(1, layout.width / scale))
  const out: number[][] = []
  const cos = Math.cos(layout.rotation ?? 0)
  const sin = Math.sin(layout.rotation ?? 0)
  const place = (x: number, y: number): [number, number] => {
    const dx = x - layout.x
    const dy = y - layout.y
    return [layout.x + dx * cos - dy * sin, layout.y + dx * sin + dy * cos]
  }

  lines.forEach((line, row) => {
    const width = wordWidth(font, line) * scale
    const free = Math.max(0, layout.width - width)
    let x = layout.x + (layout.align === 'center' ? free / 2 : layout.align === 'right' ? free : 0)
    const baseline = layout.y + size * 0.95 + row * lineHeight
    // The line rises or falls a little, and waves gently.
    const slope = jitter(0.008)
    const wave = size * 0.02
    const phase = rnd() * Math.PI * 2
    const startX = x
    for (const ch of line) {
      for (const [advance, polylines] of glyphOf(font, ch)) {
        const s = scale * (1 + jitter(0.025))
        const turn = jitter(0.025)
        const lift = jitter(size * 0.012)
        const c = Math.cos(turn)
        const t = Math.sin(turn)
        for (const poly of polylines) {
          const dense = smooth(poly)
          const points: number[] = []
          for (let i = 0; i + 1 < dense.length; i += 2) {
            const gx = dense[i]! * s
            const gy = dense[i + 1]! * s
            const px = x + gx * c - gy * t
            const along = px - startX
            const py =
              baseline +
              gx * t +
              gy * c +
              lift +
              along * slope +
              Math.sin(along / (size * 6) + phase) * wave
            const [qx, qy] = place(px, py)
            points.push(Math.round(qx * 100) / 100, Math.round(qy * 100) / 100)
          }
          // A dot (an i-dot, a full stop) is a tiny line, so it is drawn.
          if (points.length === 2) points.push(points[0]! + 0.3, points[1]! + 0.3)
          if (points.length >= 4) out.push(points)
        }
        x += advance * s * (1 + jitter(0.02))
      }
    }
  })
  return out
}
