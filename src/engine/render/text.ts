import type { Rect } from '../geometry/rect.ts'
import { styleAt, textRuns } from '../model/richText.ts'
import type { FontFamily, TextObject, TextStyle } from '../model/types.ts'
import { composite, isolate, outlinePad } from './outline.ts'

/** CSS font-family stacks; the web fonts ship with the app, so they work offline. */
export const FONT_STACKS: Record<FontFamily, string> = {
  sans: '"Plus Jakarta Sans Variable", system-ui, sans-serif',
  serif: '"Lora Variable", Georgia, serif',
  hand: '"Caveat Variable", "Bradley Hand", cursive',
  mono: '"JetBrains Mono Variable", ui-monospace, Menlo, monospace',
}

export const FONT_LABELS: Record<FontFamily, string> = {
  sans: 'Sans',
  serif: 'Serif',
  hand: 'Handwriting',
  mono: 'Mono',
}

export function cssFont(style: TextStyle, size = style.size): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${size}px ${FONT_STACKS[style.font]}`
}

/** A piece of a line in one style; `x` is measured from the line's start. */
export interface TextFragment {
  text: string
  x: number
  width: number
  style: TextStyle
}

export interface TextLine {
  text: string
  width: number
  /** Top of the line box, from the top of the text box. */
  top: number
  height: number
  /** Where the letters stand, from the top of the text box. */
  baseline: number
  fragments: TextFragment[]
}

export interface TextLayout {
  lines: TextLine[]
  /** The height of one line in the box's own style. */
  lineHeight: number
  height: number
}

let measureCtx: CanvasRenderingContext2D | null = null
let fontGeneration = 0
const layouts = new WeakMap<TextObject, { generation: number; layout: TextLayout }>()
const metricsCache = new Map<string, { ascent: number; descent: number }>()

/** Call when web fonts finish loading: measurements made with fallback fonts are stale. */
export function invalidateTextLayouts(): void {
  fontGeneration++
  metricsCache.clear()
}

function context(): CanvasRenderingContext2D {
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  return measureCtx
}

/** How far a font reaches above and below the line where letters stand. */
function fontMetrics(style: TextStyle): { ascent: number; descent: number } {
  const font = cssFont(style)
  let m = metricsCache.get(font)
  if (!m) {
    const ctx = context()
    ctx.font = font
    const t = ctx.measureText('Hg')
    m = {
      ascent: t.fontBoundingBoxAscent ?? style.size * 0.8,
      descent: t.fontBoundingBoxDescent ?? style.size * 0.2,
    }
    metricsCache.set(font, m)
  }
  return m
}

/** A piece of the text in one style, by character range. */
interface Piece {
  start: number
  end: number
  style: TextStyle
}

/**
 * Wraps the text into lines that fit the box width, the way a textarea does: at spaces, and
 * inside words only when a single word is wider than the box. Parts in other styles are measured
 * in their own font, and a line is as tall as its largest letters need, like CSS line boxes.
 */
export function layoutText(object: TextObject): TextLayout {
  const cached = layouts.get(object)
  if (cached?.generation === fontGeneration) return cached.layout
  const ctx = context()
  const text = object.text
  const runs = textRuns(object)
  const measure = (p: Piece, end = p.end) => {
    ctx.font = cssFont(p.style)
    return ctx.measureText(text.slice(p.start, end)).width
  }
  /** The width of pieces, without the spaces at the end. */
  const widthOf = (pieces: Piece[]) => {
    let w = 0
    pieces.forEach((p, i) => {
      if (i < pieces.length - 1) w += measure(p)
      else w += measure(p, p.start + text.slice(p.start, p.end).trimEnd().length)
    })
    return w
  }
  /** The pieces of the range start..end, one per run it crosses. */
  const piecesOf = (start: number, end: number): Piece[] =>
    runs
      .filter((r) => r.start < end && r.start + r.text.length > start)
      .map((r) => ({
        start: Math.max(start, r.start),
        end: Math.min(end, r.start + r.text.length),
        style: r.style,
      }))
  const append = (line: Piece[], pieces: Piece[]): Piece[] => {
    const out = [...line]
    for (const p of pieces) {
      const last = out[out.length - 1]
      if (last && last.style === p.style && last.end === p.start) {
        out[out.length - 1] = { ...last, end: p.end }
      } else {
        out.push(p)
      }
    }
    return out
  }
  const max = Math.max(object.width, object.style.size)
  const rawLines: Piece[][] = []

  let offset = 0
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/(?<= )/)
    let line: Piece[] = []
    let at = offset
    for (const word of words) {
      const pieces = piecesOf(at, at + word.length)
      at += word.length
      if (word === '') continue
      const candidate = append(line, pieces)
      if (widthOf(candidate) <= max) {
        line = candidate
        continue
      }
      if (line.length) rawLines.push(line)
      line = []
      if (widthOf(pieces) <= max) {
        line = pieces
        continue
      }
      // A word wider than the box breaks between characters.
      for (let i = at - word.length; i < at; i++) {
        const next = append(line, piecesOf(i, i + 1))
        if (line.length && widthOf(next) > max) {
          rawLines.push(line)
          line = piecesOf(i, i + 1)
        } else {
          line = next
        }
      }
    }
    // An empty line still has the height of the style it would be typed in.
    rawLines.push(
      line.length ? line : [{ start: offset, end: offset, style: styleAt(object, offset) }],
    )
    offset += paragraph.length + 1
  }

  const base = object.style
  const lines: TextLine[] = []
  let top = 0
  for (const pieces of rawLines) {
    // Every style on the line, and the box's own, as CSS does with its strut.
    let above = 0
    let below = 0
    for (const style of [base, ...pieces.map((p) => p.style)]) {
      const { ascent, descent } = fontMetrics(style)
      const leading = (style.size * base.lineHeight - ascent - descent) / 2
      above = Math.max(above, ascent + leading)
      below = Math.max(below, descent + leading)
    }
    const fragments: TextFragment[] = []
    let x = 0
    pieces.forEach((p, i) => {
      const last = i === pieces.length - 1
      const t = text.slice(p.start, p.end)
      const shown = last ? t.trimEnd() : t
      const width = measure(p, p.start + shown.length)
      fragments.push({ text: shown, x, width, style: p.style })
      x += last ? width : measure(p)
    })
    lines.push({
      text: fragments.map((f) => f.text).join(''),
      width: x,
      top,
      height: above + below,
      baseline: top + above,
      fragments,
    })
    top += above + below
  }

  const lineHeight = base.size * base.lineHeight
  const layout = { lines, lineHeight, height: Math.max(lineHeight, top) }
  layouts.set(object, { generation: fontGeneration, layout })
  return layout
}

export function textCenter(object: TextObject): { x: number; y: number } {
  const { height } = layoutText(object)
  return { x: object.x + object.width / 2, y: object.y + height / 2 }
}

/** The four corners of the (possibly rotated) box, clockwise from top-left. */
export function textCorners(object: TextObject): { x: number; y: number }[] {
  const { height } = layoutText(object)
  const c = textCenter(object)
  const cos = Math.cos(object.rotation)
  const sin = Math.sin(object.rotation)
  const hw = object.width / 2
  const hh = height / 2
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => ({ x: c.x + dx! * cos - dy! * sin, y: c.y + dx! * sin + dy! * cos }))
}

export function textBounds(object: TextObject): Rect {
  const corners = textCorners(object)
  const pad = outlinePad(object.outline)
  return {
    minX: Math.min(...corners.map((p) => p.x)) - pad,
    minY: Math.min(...corners.map((p) => p.y)) - pad,
    maxX: Math.max(...corners.map((p) => p.x)) + pad,
    maxY: Math.max(...corners.map((p) => p.y)) + pad,
  }
}

/** Whether a page point lies inside the box, taking rotation into account. */
export function textContains(object: TextObject, x: number, y: number, slop = 0): boolean {
  const { height } = layoutText(object)
  const c = textCenter(object)
  const cos = Math.cos(-object.rotation)
  const sin = Math.sin(-object.rotation)
  const dx = x - c.x
  const dy = y - c.y
  const lx = dx * cos - dy * sin
  const ly = dx * sin + dy * cos
  return Math.abs(lx) <= object.width / 2 + slop && Math.abs(ly) <= height / 2 + slop
}

export function paintText(ctx: CanvasRenderingContext2D, object: TextObject): void {
  const { lines, height } = layoutText(object)
  const { style: base } = object
  const c = textCenter(object)
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(object.rotation)
  ctx.translate(-object.width / 2, -height / 2)
  ctx.globalAlpha = base.opacity
  ctx.textBaseline = 'alphabetic'
  const outline = object.outline
  const position = outline?.position ?? 'outside'
  for (const line of lines) {
    const left =
      base.align === 'center'
        ? (object.width - line.width) / 2
        : base.align === 'right'
          ? object.width - line.width
          : 0
    const y = line.baseline
    for (const fragment of line.fragments) {
      const { style, text } = fragment
      const x = left + fragment.x
      ctx.font = cssFont(style)
      ctx.fillStyle = style.color
      ctx.strokeStyle = style.color
      if (outline && position === 'outside') {
        // Stroked behind the letters, so only the outer half of the contour shows.
        ctx.save()
        ctx.lineWidth = outline.width * 2
        ctx.lineJoin = 'round'
        ctx.strokeStyle = outline.color
        ctx.strokeText(text, x, y)
        ctx.restore()
      }
      if (outline && position === 'inside') {
        // Only inside the letters: drawn apart, where the contour can keep to their pixels.
        const own = isolate(ctx)
        own.font = ctx.font
        own.textBaseline = 'alphabetic'
        own.fillStyle = style.color
        own.fillText(text, x, y)
        own.globalCompositeOperation = 'source-atop'
        own.lineWidth = outline.width * 2
        own.lineJoin = 'round'
        own.strokeStyle = outline.color
        own.strokeText(text, x, y)
        composite(ctx, own)
      } else {
        ctx.fillText(text, x, y)
      }
      if (outline && position === 'center') {
        ctx.save()
        ctx.lineWidth = outline.width
        ctx.lineJoin = 'round'
        ctx.strokeStyle = outline.color
        ctx.strokeText(text, x, y)
        ctx.restore()
      }
      if (style.underline && fragment.width > 0) {
        ctx.lineWidth = Math.max(0.5, style.size / 16)
        const uy = y + style.size * 0.12
        ctx.beginPath()
        ctx.moveTo(x, uy)
        ctx.lineTo(x + fragment.width, uy)
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}
