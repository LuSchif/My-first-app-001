import type { SpanStyle, TextObject, TextSpan, TextStyle } from './types.ts'

/**
 * Text boxes with parts formatted differently (a bold word, a larger heading). The box keeps a
 * style for all of its text; spans override it for ranges of characters. Edits work on one
 * override per character and are packed back into spans, so spans never overlap and never
 * repeat the box style.
 */

export const SPAN_KEYS = ['font', 'size', 'color', 'bold', 'italic', 'underline'] as const

/** A stretch of text with one style. */
export interface TextRun {
  start: number
  text: string
  style: TextStyle
}

/** The overrides of every character. */
function perChar(object: TextObject): SpanStyle[] {
  const out: SpanStyle[] = Array.from({ length: object.text.length }, () => ({}))
  for (const span of object.spans ?? []) {
    for (let i = Math.max(0, span.start); i < Math.min(out.length, span.end); i++) {
      out[i] = span.style
    }
  }
  return out
}

/** Packs per-character overrides into spans, leaving out what the box style already says. */
function pack(chars: SpanStyle[], base: TextStyle): TextSpan[] | undefined {
  const spans: TextSpan[] = []
  let last: TextSpan | null = null
  let lastKey = ''
  chars.forEach((style, i) => {
    const own: SpanStyle = {}
    for (const key of SPAN_KEYS) {
      if (style[key] !== undefined && style[key] !== base[key]) {
        ;(own as Record<string, unknown>)[key] = style[key]
      }
    }
    const key = JSON.stringify(own)
    if (key === '{}') {
      last = null
      return
    }
    if (last && lastKey === key && last.end === i) {
      last.end = i + 1
      return
    }
    last = { start: i, end: i + 1, style: own }
    lastKey = key
    spans.push(last)
  })
  return spans.length ? spans : undefined
}

function withSpans(object: TextObject, spans: TextSpan[] | undefined): TextObject {
  const { spans: _old, ...rest } = object
  return spans ? { ...rest, spans } : rest
}

/** The full style of the character at `index` (the last one at the end of the text). */
export function styleAt(object: TextObject, index: number): TextStyle {
  const i = Math.min(index, object.text.length - 1)
  const span = object.spans?.find((s) => s.start <= i && i < s.end)
  return span ? { ...object.style, ...span.style } : object.style
}

/** The text cut into runs of one style each. */
export function textRuns(object: TextObject): TextRun[] {
  const runs: TextRun[] = []
  let at = 0
  for (const span of object.spans ?? []) {
    const start = Math.max(at, span.start)
    const end = Math.min(object.text.length, span.end)
    if (start >= end) continue
    if (start > at)
      runs.push({ start: at, text: object.text.slice(at, start), style: object.style })
    runs.push({
      start,
      text: object.text.slice(start, end),
      style: { ...object.style, ...span.style },
    })
    at = end
  }
  if (at < object.text.length || runs.length === 0) {
    runs.push({ start: at, text: object.text.slice(at), style: object.style })
  }
  return runs
}

/** Formats the characters from `start` to `end`; the rest of the text keeps its style. */
export function formatRange(
  object: TextObject,
  start: number,
  end: number,
  patch: SpanStyle,
): TextObject {
  const chars = perChar(object)
  for (let i = Math.max(0, start); i < Math.min(chars.length, end); i++) {
    chars[i] = { ...chars[i], ...patch }
  }
  return withSpans(object, pack(chars, object.style))
}

/** Changes the style of the whole box: parts formatted differently follow it too. */
export function formatAll(object: TextObject, patch: Partial<TextStyle>): TextObject {
  const style = { ...object.style, ...patch }
  const chars = perChar(object).map((c) => {
    const rest = { ...c }
    for (const key of Object.keys(patch)) delete (rest as Record<string, unknown>)[key]
    return rest
  })
  return withSpans({ ...object, style }, pack(chars, style))
}

/**
 * The text changed from `object.text` to `text`. The spans move with the characters they
 * format; new characters take the style of the character before them.
 */
export function editText(object: TextObject, text: string): TextObject {
  const old = object.text
  if (!object.spans) return { ...object, text }
  let prefix = 0
  while (prefix < old.length && prefix < text.length && old[prefix] === text[prefix]) prefix++
  let suffix = 0
  while (
    suffix < old.length - prefix &&
    suffix < text.length - prefix &&
    old[old.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix++
  }
  const chars = perChar(object)
  const inherit = chars[prefix - 1] ?? chars[prefix] ?? {}
  const inserted = Array.from({ length: text.length - prefix - suffix }, () => inherit)
  chars.splice(prefix, old.length - prefix - suffix, ...inserted)
  return withSpans({ ...object, text }, pack(chars, object.style))
}

/** Scales every font size in the box, also those of formatted parts. */
export function scaleText(object: TextObject, factor: number): TextObject {
  const style = { ...object.style, size: object.style.size * factor }
  const spans = object.spans?.map((s) =>
    s.style.size === undefined ? s : { ...s, style: { ...s.style, size: s.style.size * factor } },
  )
  return withSpans({ ...object, style }, spans)
}
