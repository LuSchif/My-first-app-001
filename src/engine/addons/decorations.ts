import { FONT_STACKS } from '../render/text.ts'
import type { Addon, AddonOf, DateTimeSettings, PageNumberSettings, Spot } from './types.ts'

/** Distance of labels from the edge of the page, in points. */
const MARGIN = 18

interface Label {
  text: string
  color: string
  size: number
  mark: string | null
}

/**
 * Draws what addons show on a page (date and time, page numbers) onto `ctx`, which is in the
 * page's coordinates. Labels in the same spot sit side by side.
 */
export function paintPageLabels(
  ctx: CanvasRenderingContext2D,
  addons: readonly Addon[],
  pageIndex: number,
  pageCount: number,
  size: { width: number; height: number },
  now: Date,
): void {
  const bySpot = new Map<Spot, Label[]>()
  const put = (spot: Spot, label: Label) => {
    const list = bySpot.get(spot) ?? []
    list.push(label)
    bySpot.set(spot, list)
  }
  for (const addon of addons) {
    if (addon.kind === 'dateTime') dateTimeLabels(addon.settings, now, put)
    if (addon.kind === 'pageNumbers') {
      const text = pageNumberText(addon.settings, pageIndex, pageCount)
      if (text) put(addon.settings.spot, labelOf(addon.settings, text))
    }
  }
  for (const [spot, labels] of bySpot) paintSpot(ctx, spot, labels, size)
}

/** Whether any of `addons` shows something that changes with the clock. */
export function showsTime(addons: readonly Addon[]): boolean {
  return addons.some((a) => a.kind === 'dateTime' && (a.settings.showTime || a.settings.showDate))
}

function labelOf(
  s: { color: string; size: number; marked: boolean; markColor: string },
  text: string,
): Label {
  return { text, color: s.color, size: s.size, mark: s.marked ? s.markColor : null }
}

function dateTimeLabels(s: DateTimeSettings, now: Date, put: (spot: Spot, l: Label) => void) {
  const date = s.showDate ? formatDate(now, s.dateStyle) : ''
  const time = s.showTime ? formatTime(now) : ''
  if (date && time && s.dateSpot === s.timeSpot) {
    put(s.dateSpot, labelOf(s, `${date} · ${time}`))
    return
  }
  if (date) put(s.dateSpot, labelOf(s, date))
  if (time) put(s.timeSpot, labelOf(s, time))
}

/**
 * Date and time formats, made once: building them is slow on iPad (it was done on every frame
 * before), and the text itself is kept for the minute.
 */
const FORMATS = {
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

const formatters = new Map<keyof typeof FORMATS, Intl.DateTimeFormat>()
const texts = new Map<string, string>()

function formatted(now: Date, kind: keyof typeof FORMATS): string {
  const key = `${kind}:${Math.floor(now.getTime() / 60_000)}`
  let text = texts.get(key)
  if (text === undefined) {
    let f = formatters.get(kind)
    if (!f) {
      f = new Intl.DateTimeFormat(undefined, FORMATS[kind])
      formatters.set(kind, f)
    }
    text = f.format(now)
    if (texts.size > 16) texts.clear()
    texts.set(key, text)
  }
  return text
}

export function formatDate(now: Date, style: DateTimeSettings['dateStyle']): string {
  return formatted(now, style)
}

export function formatTime(now: Date): string {
  return formatted(now, 'time')
}

/** The page number label of page `pageIndex` (0-based), or '' when it has none. */
export function pageNumberText(
  s: PageNumberSettings,
  pageIndex: number,
  pageCount: number,
): string {
  const first = Math.max(1, Math.round(s.startPage))
  if (pageIndex + 1 < first) return ''
  const n = pageIndex + 1 - first + s.firstNumber
  const last = pageCount - first + s.firstNumber
  if (s.style === 'page') return `Page ${n}`
  if (s.style === 'of') return `${n} / ${last}`
  if (s.style === 'dashes') return `– ${n} –`
  return String(n)
}

function paintSpot(
  ctx: CanvasRenderingContext2D,
  spot: Spot,
  labels: Label[],
  size: { width: number; height: number },
): void {
  const gap = 10
  ctx.save()
  ctx.textBaseline = 'middle'
  const widths = labels.map((l) => textWidth(ctx, l) + (l.mark ? l.size * 0.8 : 0))
  const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1)
  const height = Math.max(...labels.map((l) => l.size)) * 1.5
  const [vertical, horizontal] = spot.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right']
  let x =
    horizontal === 'left'
      ? MARGIN
      : horizontal === 'right'
        ? size.width - MARGIN - total
        : (size.width - total) / 2
  const y = vertical === 'top' ? MARGIN + height / 2 : size.height - MARGIN - height / 2
  labels.forEach((l, i) => {
    const w = widths[i]!
    ctx.font = `600 ${l.size}px ${FONT_STACKS.sans}`
    if (l.mark) {
      const h = l.size * 1.45
      ctx.fillStyle = l.mark
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.roundRect(x, y - h / 2, w, h, h * 0.3)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = l.color
    ctx.fillText(l.text, x + (l.mark ? l.size * 0.4 : 0), y)
    x += w + gap
  })
  ctx.restore()
}

export type DateTimeAddon = AddonOf<'dateTime'>

const widthCache = new Map<string, number>()

/** The width of a label's text, measured once per text and size. */
function textWidth(ctx: CanvasRenderingContext2D, l: Label): number {
  const key = `${l.size}|${l.text}`
  let w = widthCache.get(key)
  if (w === undefined) {
    ctx.font = `600 ${l.size}px ${FONT_STACKS.sans}`
    w = ctx.measureText(l.text).width
    if (widthCache.size > 200) widthCache.clear()
    widthCache.set(key, w)
  }
  return w
}

/** The notebook's name at the top left of a page, in the margin above its first line. */
export function paintPageTitle(ctx: CanvasRenderingContext2D, title: string): void {
  ctx.save()
  ctx.font = `700 15px ${FONT_STACKS.sans}`
  ctx.fillStyle = '#2a2622'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(title.length > 40 ? `${title.slice(0, 39)}…` : title, 18, 32)
  ctx.restore()
}
