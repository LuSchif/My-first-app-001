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
 * (the order they were written in). The strokes' heights are laid side by side on the page's
 * height: where they overlap or nearly touch, it is one line, so i-dots, commas, accents and
 * descenders stay with their words. Only a clear gap between bands of writing starts a new line.
 */
export function groupLines(strokes: readonly Ink[]): Ink[][] {
  const items = strokes
    .map((ink, order) => ({ ink, order, box: boxOf(ink) }))
    .filter((s): s is { ink: Ink; order: number; box: Box } => s.box !== null)
  if (items.length === 0) return []
  const heights = items.map((s) => s.box.maxY - s.box.minY).sort((a, b) => a - b)
  // The height of a typical letter stroke (dots and commas do not count).
  const letter = Math.max(4, heights[Math.floor(heights.length * 0.75)] ?? 4)
  const gap = letter * 0.25
  const byTop = [...items].sort((a, b) => a.box.minY - b.box.minY)
  const bands: { bottom: number; members: typeof items }[] = []
  for (const s of byTop) {
    const band = bands[bands.length - 1]
    if (band && s.box.minY <= band.bottom + gap) {
      band.members.push(s)
      band.bottom = Math.max(band.bottom, s.box.maxY)
    } else {
      bands.push({ bottom: s.box.maxY, members: [s] })
    }
  }
  return bands.map((b) => b.members.sort((x, y) => x.order - y.order).map((m) => m.ink))
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
