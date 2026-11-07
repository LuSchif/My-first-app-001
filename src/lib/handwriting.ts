/**
 * Reading handwriting from its strokes (online recognition): how and in which order the lines
 * were written tells far more than a picture of them. The strokes are grouped into lines, and
 * each line is read by Google's handwriting recognition (the service behind handwriting input
 * in Google Translate and Gboard). Needs a connection; callers fall back to reading a picture
 * (lib/ocr.ts) when it fails.
 */

/** One stroke in page points: x0, y0, x1, y1, …; `t` in milliseconds per point, if known. */
export interface Ink {
  points: readonly number[]
  t?: readonly number[]
}

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const ENDPOINT =
  'https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8'
/** Most lines read at once from one page (drawings with many strokes make many "lines"). */
const MAX_LINES = 60

function boxOf(ink: Ink): Box | null {
  const p = ink.points
  if (p.length < 2) return null
  const box = { minX: p[0]!, minY: p[1]!, maxX: p[0]!, maxY: p[1]! }
  for (let i = 2; i + 1 < p.length; i += 2) {
    box.minX = Math.min(box.minX, p[i]!)
    box.maxX = Math.max(box.maxX, p[i]!)
    box.minY = Math.min(box.minY, p[i + 1]!)
    box.maxY = Math.max(box.maxY, p[i + 1]!)
  }
  return box
}

/**
 * The strokes as lines of writing, top to bottom; within a line the strokes keep their order
 * (the order they were written in). A stroke belongs to a line when most of its height lies
 * within the line's, so i-dots, accents and small letters join their line.
 */
export function groupLines(strokes: readonly Ink[]): Ink[][] {
  const items = strokes
    .map((ink, order) => ({ ink, order, box: boxOf(ink) }))
    .filter((s): s is { ink: Ink; order: number; box: Box } => s.box !== null)
  // Tall strokes first, so they set the lines that small marks then join.
  const byHeight = [...items].sort((a, b) => b.box.maxY - b.box.minY - (a.box.maxY - a.box.minY))
  const lines: { top: number; bottom: number; members: typeof items }[] = []
  for (const s of byHeight) {
    const h = Math.max(1, s.box.maxY - s.box.minY)
    const line = lines.find((l) => {
      const overlap = Math.min(l.bottom, s.box.maxY) - Math.max(l.top, s.box.minY)
      const lineH = l.bottom - l.top
      // A mark above the line (a dot, an accent) close to it also belongs to it.
      const near = s.box.maxY <= l.top && l.top - s.box.maxY < lineH * 0.5 && h < lineH * 0.4
      return overlap >= Math.min(h, lineH) * 0.5 || near
    })
    if (line) {
      line.members.push(s)
      line.top = Math.min(line.top, s.box.minY)
      line.bottom = Math.max(line.bottom, s.box.maxY)
    } else {
      lines.push({ top: s.box.minY, bottom: s.box.maxY, members: [s] })
    }
  }
  return lines
    .sort((a, b) => a.top - b.top)
    .map((l) => l.members.sort((a, b) => a.order - b.order).map((m) => m.ink))
}

/** The request for one line: its strokes relative to the line's box, with times. */
export function lineRequest(line: readonly Ink[], language: string): object {
  const boxes = line.map(boxOf).filter((b): b is Box => b !== null)
  const minX = Math.min(...boxes.map((b) => b.minX))
  const minY = Math.min(...boxes.map((b) => b.minY))
  const maxX = Math.max(...boxes.map((b) => b.maxX))
  const maxY = Math.max(...boxes.map((b) => b.maxY))
  let clock = 0
  const ink = line.map((stroke) => {
    const xs: number[] = []
    const ys: number[] = []
    const ts: number[] = []
    const n = stroke.points.length / 2
    for (let i = 0; i < n; i++) {
      xs.push(Math.round((stroke.points[2 * i]! - minX) * 10) / 10)
      ys.push(Math.round((stroke.points[2 * i + 1]! - minY) * 10) / 10)
      ts.push(Math.round(clock + (stroke.t?.[i] ?? i * 8)))
    }
    clock = (ts[ts.length - 1] ?? clock) + 120
    return [xs, ys, ts]
  })
  return {
    writing_guide: {
      writing_area_width: Math.max(1, Math.round(maxX - minX)),
      writing_area_height: Math.max(1, Math.round(maxY - minY)),
    },
    ink,
    language,
  }
}

/** The best reading of each request in a response; throws on a failed one. */
export function parseResponse(body: unknown): string[] {
  if (!Array.isArray(body) || body[0] !== 'SUCCESS' || !Array.isArray(body[1])) {
    throw new Error('Handwriting recognition failed')
  }
  return (body[1] as unknown[]).map((entry) => {
    const candidates = Array.isArray(entry) ? entry[1] : null
    return Array.isArray(candidates) && typeof candidates[0] === 'string' ? candidates[0] : ''
  })
}

async function readLine(line: readonly Ink[], language: string): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      options: 'enable_pre_space',
      requests: [lineRequest(line, language)],
    }),
  })
  if (!response.ok) throw new Error(`Handwriting recognition: ${response.status}`)
  return parseResponse(await response.json())[0] ?? ''
}

/** The handwritten text, one line of writing per line; empty without strokes. */
export async function recognizeHandwriting(
  strokes: readonly Ink[],
  language = 'de',
): Promise<string> {
  const lines = groupLines(strokes).slice(0, MAX_LINES)
  const read = await Promise.all(lines.map((line) => readLine(line, language)))
  return read
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}
