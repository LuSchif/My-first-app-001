import type { CanvasObject } from '../../engine/model/types.ts'
import {
  alternativesOf,
  readHandwritingLines,
  recognizeHandwriting,
  type Ink,
} from '../../lib/handwriting.ts'
import { onlineHandwritingOn } from '../../lib/handwritingSetting.ts'
import { recognizeText } from '../../lib/ocr.ts'

/**
 * Handwriting among these objects that has to be read: pen strokes, not highlighter, tape,
 * drawn shapes or generated handwriting (whose text is known, see `writtenTextOf`).
 */
export function inkOf(objects: readonly CanvasObject[]): Ink[] {
  return objects.flatMap((o) =>
    o.type === 'stroke' && o.tool === 'pen' && !o.closed && !o.straight && !o.written
      ? [{ points: o.points, t: o.input?.t }]
      : [],
  )
}

/** The exact texts of the generated handwriting among these objects, top to bottom. */
export function writtenTextOf(objects: readonly CanvasObject[]): string {
  const groups = new Map<string, { text: string; top: number }>()
  for (const o of objects) {
    if (o.type !== 'stroke' || !o.written) continue
    let top = Infinity
    for (let i = 1; i < o.points.length; i += 2) top = Math.min(top, o.points[i]!)
    const group = groups.get(o.written.id)
    if (group) group.top = Math.min(group.top, top)
    else groups.set(o.written.id, { text: o.written.text, top })
  }
  return [...groups.values()]
    .sort((a, b) => a.top - b.top)
    .map((g) => g.text)
    .join('\n')
}

/**
 * Reads handwriting: from its strokes by online handwriting recognition when that is on and
 * works, otherwise from a picture (made only when needed) on the device.
 */
export async function readHandwriting(
  ink: readonly Ink[],
  picture: () => HTMLCanvasElement | null,
): Promise<string> {
  if (ink.length && onlineHandwritingOn() && navigator.onLine !== false) {
    try {
      return await recognizeHandwriting(ink)
    } catch {
      // Offline or refused: read the picture instead.
    }
  }
  return readPicture(picture())
}

/**
 * Reads handwriting like `readHandwriting`, with whole-text readings to choose from (best
 * first) when it was read from its strokes.
 */
export async function readHandwritingChoices(
  ink: readonly Ink[],
  picture: () => HTMLCanvasElement | null,
): Promise<{ text: string; alternatives: string[] }> {
  if (ink.length && onlineHandwritingOn() && navigator.onLine !== false) {
    try {
      const lines = await readHandwritingLines(ink)
      const alternatives = alternativesOf(lines)
      return { text: alternatives[0] ?? '', alternatives }
    } catch {
      // Offline or refused: read the picture instead.
    }
  }
  return { text: await readPicture(picture()), alternatives: [] }
}

/** The text in a picture, read on the device; the picture's memory is freed afterwards. */
export async function readPicture(canvas: HTMLCanvasElement | null): Promise<string> {
  if (!canvas) return ''
  try {
    return await recognizeText(canvas)
  } finally {
    canvas.width = canvas.height = 0
  }
}
