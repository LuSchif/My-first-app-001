import { formatRange } from '../model/richText.ts'
import type { CanvasObject, LayerDef, StrokeObject, TextObject } from '../model/types.ts'
import { charBoxes, layoutText, textCenter, textContains } from '../render/text.ts'

/** Share of a highlighter stroke that must lie on text for it to become a text highlight. */
const ON_TEXT = 0.7
/** A line needs this share of the stroke's points on it to be marked. */
const LINE_SHARE = 0.15

/** A page point in a text box's own coordinates (unrotated, from its top-left corner). */
function toLocal(object: TextObject, x: number, y: number): { x: number; y: number } {
  const { height } = layoutText(object)
  const c = textCenter(object)
  const cos = Math.cos(-object.rotation)
  const sin = Math.sin(-object.rotation)
  const dx = x - c.x
  const dy = y - c.y
  return { x: dx * cos - dy * sin + object.width / 2, y: dx * sin + dy * cos + height / 2 }
}

/**
 * A highlighter stroke drawn over typed text becomes a real text highlight in the stroke's
 * color: the characters it covers get a marker background, neatly fitting the lines. Returns
 * the page's objects with the text marked (and without the stroke), or null when the stroke is
 * not over text it can mark.
 */
export function highlightText(
  objects: readonly CanvasObject[],
  stroke: StrokeObject,
  layers: readonly LayerDef[],
): CanvasObject[] | null {
  const usable = (o: CanvasObject): o is TextObject => {
    if (o.type !== 'text') return false
    const layer = layers.find((l) => l.id === o.layerId)
    return Boolean(layer?.visible && !layer.locked)
  }
  const texts = objects.filter(usable)
  if (!texts.length) return null
  const n = stroke.points.length / 2
  const reach = stroke.width / 4
  let onText = 0
  // Points on each text box, in its coordinates.
  const hits = new Map<TextObject, { x: number; y: number }[]>()
  for (let i = 0; i < n; i++) {
    const x = stroke.points[i * 2]!
    const y = stroke.points[i * 2 + 1]!
    // The topmost box under the point takes it.
    const box = [...texts].reverse().find((t) => textContains(t, x, y, reach))
    if (!box) continue
    onText++
    const list = hits.get(box) ?? []
    list.push(toLocal(box, x, y))
    hits.set(box, list)
  }
  if (onText < n * ON_TEXT) return null

  const changed = new Map<TextObject, TextObject>()
  for (const [box, points] of hits) {
    const { lines } = layoutText(box)
    const chars = charBoxes(box)
    let marked = box
    lines.forEach((line, li) => {
      const onLine = points.filter((p) => p.y >= line.top && p.y <= line.top + line.height)
      if (onLine.length < Math.max(2, points.length * LINE_SHARE)) return
      const minX = Math.min(...onLine.map((p) => p.x)) - stroke.width * 0.25
      const maxX = Math.max(...onLine.map((p) => p.x)) + stroke.width * 0.25
      const covered = chars.filter(
        (c) => c.line === li && (c.x0 + c.x1) / 2 >= minX && (c.x0 + c.x1) / 2 <= maxX,
      )
      if (!covered.length) return
      const range = toWords(box.text, covered[0]!.index, covered[covered.length - 1]!.index + 1)
      if (range) marked = formatRange(marked, range.start, range.end, { highlight: stroke.color })
    })
    if (marked !== box) changed.set(box, marked)
  }
  if (!changed.size) return null
  return objects.map((o) => (o.type === 'text' && changed.get(o)) || o)
}

/**
 * Snaps a marked range to whole words: a word more than half covered is marked whole, a word
 * barely touched at either end is left out.
 */
export function toWords(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  const isWord = (c: string | undefined) => c !== undefined && /\S/.test(c)
  let ws = start
  while (isWord(text[ws - 1])) ws--
  let we = start
  while (isWord(text[we])) we++
  if (isWord(text[start])) start = start - ws <= (we - ws) / 2 ? ws : we
  let es = end
  while (isWord(text[es - 1])) es--
  let ee = end
  while (isWord(text[ee])) ee++
  if (isWord(text[end - 1]) && isWord(text[end])) end = ee - end <= (ee - es) / 2 ? ee : es
  // Spaces at the edges stay unmarked.
  while (start < end && !isWord(text[start])) start++
  while (end > start && !isWord(text[end - 1])) end--
  return end > start ? { start, end } : null
}
