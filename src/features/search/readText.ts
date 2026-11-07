import type { CanvasObject } from '../../engine/model/types.ts'
import { recognizeHandwriting, type Ink } from '../../lib/handwriting.ts'
import { onlineHandwritingOn } from '../../lib/handwritingSetting.ts'
import { recognizeText } from '../../lib/ocr.ts'

/** Handwriting among these objects: pen strokes, not highlighter, tape or drawn shapes. */
export function inkOf(objects: readonly CanvasObject[]): Ink[] {
  return objects.flatMap((o) =>
    o.type === 'stroke' && o.tool === 'pen' && !o.closed && !o.straight
      ? [{ points: o.points, t: o.input?.t }]
      : [],
  )
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

/** The text in a picture, read on the device; the picture's memory is freed afterwards. */
export async function readPicture(canvas: HTMLCanvasElement | null): Promise<string> {
  if (!canvas) return ''
  try {
    return await recognizeText(canvas)
  } finally {
    canvas.width = canvas.height = 0
  }
}
