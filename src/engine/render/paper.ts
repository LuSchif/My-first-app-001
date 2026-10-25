import { PAGE_SIZE, type PageSize, type PaperKind } from '../model/types.ts'

const MM = 72 / 25.4
export const PAPER_STYLE = {
  paper: '#fffdf8',
  rule: 'rgba(121, 90, 70, 0.24)',
  margin: 'rgba(185, 139, 101, 0.5)',
  dot: 'rgba(121, 90, 70, 0.42)',
  lined: { top: 96, gap: 24, bottom: 48, margin: 64 },
  grid: { size: 5 * MM },
  /** Staves of five lines; `gap` is the space between two lines of a staff. */
  music: { top: 72, gap: 7, pitch: 58, bottom: 48, side: 40 },
} as const

/**
 * Draws the paper pattern in page coordinates. Line widths are divided by the zoom level, so the
 * pattern stays one crisp hairline at every zoom.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  kind: PaperKind,
  zoom: number,
  size: PageSize = PAGE_SIZE,
): void {
  const { width, height } = size
  const hair = 0.8 / zoom
  if (kind === 'lined') {
    const s = PAPER_STYLE.lined
    ctx.lineWidth = hair
    ctx.strokeStyle = PAPER_STYLE.rule
    ctx.beginPath()
    for (let y = s.top; y <= height - s.bottom; y += s.gap) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
    ctx.strokeStyle = PAPER_STYLE.margin
    ctx.beginPath()
    ctx.moveTo(s.margin, 0)
    ctx.lineTo(s.margin, height)
    ctx.stroke()
  } else if (kind === 'grid') {
    const g = PAPER_STYLE.grid.size
    const offX = (width % g) / 2
    const offY = (height % g) / 2
    ctx.lineWidth = hair
    ctx.strokeStyle = PAPER_STYLE.rule
    ctx.beginPath()
    for (let x = offX; x <= width; x += g) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let y = offY; y <= height; y += g) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()
  } else if (kind === 'music') {
    const m = PAPER_STYLE.music
    const staff = m.gap * 4
    ctx.lineWidth = hair
    ctx.strokeStyle = PAPER_STYLE.rule
    ctx.beginPath()
    for (let top = m.top; top + staff <= height - m.bottom; top += m.pitch) {
      for (let line = 0; line < 5; line++) {
        const y = top + line * m.gap
        ctx.moveTo(m.side, y)
        ctx.lineTo(width - m.side, y)
      }
      // Each staff starts and ends with a bar line.
      ctx.moveTo(m.side, top)
      ctx.lineTo(m.side, top + staff)
      ctx.moveTo(width - m.side, top)
      ctx.lineTo(width - m.side, top + staff)
    }
    ctx.stroke()
  } else if (kind === 'dotted') {
    const g = PAPER_STYLE.grid.size
    const offX = (width % g) / 2
    const offY = (height % g) / 2
    // Dots keep a minimum on-screen size so they never vanish when zoomed out.
    const r = Math.max(0.55, 0.9 / zoom)
    ctx.fillStyle = PAPER_STYLE.dot
    ctx.beginPath()
    for (let x = offX; x <= width; x += g) {
      for (let y = offY; y <= height; y += g) {
        ctx.moveTo(x + r, y)
        ctx.arc(x, y, r, 0, Math.PI * 2)
      }
    }
    ctx.fill()
  }
}
