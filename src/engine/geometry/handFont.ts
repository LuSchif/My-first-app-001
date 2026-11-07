/**
 * Writing text as generated handwriting: single-line fonts (each glyph is a few pen lines,
 * see engine/fonts) laid out like text, with the small irregularities of a hand (a wavering
 * baseline, letters slightly turned, sized and spaced unevenly, lines that wobble a little).
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

/** Points no farther apart than `step`, so the wobble bends lines smoothly. */
function densify(points: number[], step: number): number[] {
  const out = [points[0]!, points[1]!]
  for (let i = 2; i + 1 < points.length; i += 2) {
    const x0 = points[i - 2]!
    const y0 = points[i - 1]!
    const x1 = points[i]!
    const y1 = points[i + 1]!
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let k = 1; k <= n; k++) out.push(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)
  }
  return out
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
    const slope = jitter(0.012)
    const wave = size * 0.035
    const phase = rnd() * Math.PI * 2
    const startX = x
    for (const ch of line) {
      for (const [advance, polylines] of glyphOf(font, ch)) {
        const s = scale * (1 + jitter(0.045))
        const turn = jitter(0.045)
        const lift = jitter(size * 0.025)
        const c = Math.cos(turn)
        const t = Math.sin(turn)
        for (const poly of polylines) {
          const dense = densify(poly, font.cap * 0.06)
          const points: number[] = []
          const wobble = rnd() * Math.PI * 2
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
            // A slightly unsteady pen.
            const shake = Math.sin(i * 0.35 + wobble) * size * 0.008
            const [qx, qy] = place(px + shake, py + shake * 0.6)
            points.push(Math.round(qx * 100) / 100, Math.round(qy * 100) / 100)
          }
          // A dot (an i-dot, a full stop) is a tiny line, so it is drawn.
          if (points.length === 2) points.push(points[0]! + 0.3, points[1]! + 0.3)
          if (points.length >= 4) out.push(points)
        }
        x += advance * s * (1 + jitter(0.03))
      }
    }
  })
  return out
}
