/**
 * A fill for folders, notebook covers and canvas objects: a solid color or a gradient.
 * Colors are hex strings (#rrggbb). Gradient stops are sorted by offset (0–1) when rendered.
 */
export type Fill = SolidFill | LinearGradientFill | RadialGradientFill

export interface SolidFill {
  type: 'solid'
  color: string
}

export interface LinearGradientFill {
  type: 'linear'
  /** Direction in degrees, as in CSS: 0 points up, 90 points right. */
  angle: number
  stops: GradientStop[]
}

export interface RadialGradientFill {
  type: 'radial'
  stops: GradientStop[]
}

export interface GradientStop {
  offset: number
  color: string
}

/** CSS `background` value for a fill. */
export function fillToCss(fill: Fill): string {
  if (fill.type === 'solid') return fill.color
  const stops = [...fill.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${round(clamp01(s.offset) * 100)}%`)
    .join(', ')
  if (fill.type === 'linear') return `linear-gradient(${round(fill.angle)}deg, ${stops})`
  return `radial-gradient(circle at 50% 50%, ${stops})`
}

/** A single representative color, e.g. for an icon tint or a text color decision. */
export function fillBaseColor(fill: Fill): string {
  if (fill.type === 'solid') return fill.color
  const first = [...fill.stops].sort((a, b) => a.offset - b.offset)[0]
  return first?.color ?? '#000000'
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Normalizes user input like "abc", "#ABC" or "#aabbcc" to "#aabbcc"; null if invalid. */
export function parseHex(input: string): string | null {
  const match = HEX.exec(input.trim())
  if (!match?.[1]) return null
  const hex = match[1].toLowerCase()
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  return `#${full}`
}

/** Relative luminance per WCAG 2.x, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const full = parseHex(hex) ?? '#000000'
  const channel = (i: number) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Whether light text reads better than dark text on this fill. */
export function prefersLightText(fill: Fill): boolean {
  const colors = fill.type === 'solid' ? [fill.color] : fill.stops.map((s) => s.color)
  const avg = colors.reduce((sum, c) => sum + luminance(c), 0) / Math.max(colors.length, 1)
  // Contrast with white equals contrast with near-black at about this luminance.
  return avg < 0.18
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
