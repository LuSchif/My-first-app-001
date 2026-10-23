import type { Rect } from '../geometry/rect.ts'
import type { FontFamily, TextObject, TextStyle } from '../model/types.ts'

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

export interface TextLayout {
  lines: { text: string; width: number }[]
  lineHeight: number
  height: number
}

let measureCtx: CanvasRenderingContext2D | null = null
let fontGeneration = 0
const layouts = new WeakMap<TextObject, { generation: number; layout: TextLayout }>()

/** Call when web fonts finish loading: measurements made with fallback fonts are stale. */
export function invalidateTextLayouts(): void {
  fontGeneration++
}

/**
 * Wraps the text into lines that fit the box width, the way a textarea does: at spaces, and
 * inside words only when a single word is wider than the box.
 */
export function layoutText(object: TextObject): TextLayout {
  const cached = layouts.get(object)
  if (cached?.generation === fontGeneration) return cached.layout
  measureCtx ??= document.createElement('canvas').getContext('2d')!
  const ctx = measureCtx
  ctx.font = cssFont(object.style)
  const measure = (s: string) => ctx.measureText(s).width
  const max = Math.max(object.width, object.style.size)
  const lines: TextLayout['lines'] = []

  for (const paragraph of object.text.split('\n')) {
    const words = paragraph.split(/(?<= )/)
    let line = ''
    for (const word of words) {
      const candidate = line + word
      if (measure(candidate.trimEnd()) <= max) {
        line = candidate
        continue
      }
      if (line !== '') lines.push({ text: line.trimEnd(), width: measure(line.trimEnd()) })
      line = ''
      if (measure(word.trimEnd()) <= max) {
        line = word
        continue
      }
      // A word wider than the box breaks between characters.
      for (const char of word) {
        if (line !== '' && measure(line + char) > max) {
          lines.push({ text: line, width: measure(line) })
          line = ''
        }
        line += char
      }
    }
    lines.push({ text: line.trimEnd(), width: measure(line.trimEnd()) })
  }

  const lineHeight = object.style.size * object.style.lineHeight
  const layout = { lines, lineHeight, height: Math.max(1, lines.length) * lineHeight }
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
  return {
    minX: Math.min(...corners.map((p) => p.x)),
    minY: Math.min(...corners.map((p) => p.y)),
    maxX: Math.max(...corners.map((p) => p.x)),
    maxY: Math.max(...corners.map((p) => p.y)),
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
  const { lines, lineHeight, height } = layoutText(object)
  const { style } = object
  const c = textCenter(object)
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(object.rotation)
  ctx.translate(-object.width / 2, -height / 2)
  ctx.font = cssFont(style)
  ctx.fillStyle = style.color
  ctx.strokeStyle = style.color
  ctx.globalAlpha = style.opacity
  // Glyphs sit in the middle of each line box, like CSS half-leading.
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    const x =
      style.align === 'center'
        ? (object.width - line.width) / 2
        : style.align === 'right'
          ? object.width - line.width
          : 0
    const y = i * lineHeight + lineHeight / 2
    ctx.fillText(line.text, x, y)
    if (style.underline && line.width > 0) {
      ctx.lineWidth = Math.max(0.5, style.size / 16)
      const uy = y + style.size * 0.42
      ctx.beginPath()
      ctx.moveTo(x, uy)
      ctx.lineTo(x + line.width, uy)
      ctx.stroke()
    }
  })
  ctx.restore()
}
