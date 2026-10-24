import type { Point } from '../geometry/camera.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import type { EditorContext } from './context.ts'
import type { FxPainter } from './FxLayer.ts'

/** How long the trail stays visible behind the pointer. */
const FADE_MS = 800
const CORE_PX = 4
const GLOW_PX = 14
const BROOM_PX = 34

interface TrailPoint {
  /** World coordinates, so the trail stays on the page while it scrolls. */
  x: number
  y: number
  t: number
  /** Starts a new line (a new touch-down). */
  start: boolean
}

/**
 * Points at things while presenting: a glowing line in the laser color that follows the pen and
 * fades away, led by a broom of the same color. It never changes the notebook.
 *
 * It draws on the effects layer with plain strokes (a wide, faint one for the glow under a
 * narrow, bright one), never a canvas shadow: blurred shadows cost far too much per frame.
 */
export class LaserPointer implements FxPainter {
  private readonly ctx: EditorContext
  private readonly request: () => void
  color = '#e0533f'
  private trail: TrailPoint[] = []
  private pointerId: number | null = null
  private head: Point | null = null

  constructor(ctx: EditorContext, request: () => void) {
    this.ctx = ctx
    this.request = request
  }

  get busy(): boolean {
    return this.pointerId !== null
  }

  down(e: PointerEvent): void {
    this.pointerId = e.pointerId
    this.add(e, true)
    this.head = this.ctx.screenPos(e)
    this.request()
  }

  move(e: PointerEvent): boolean {
    if (e.pointerId !== this.pointerId) return false
    const events = e.getCoalescedEvents?.() ?? []
    for (const ev of events.length ? events : [e]) this.add(ev, false)
    // The broom leads where the pen is about to be, so it does not lag behind the tip.
    const ahead = e.getPredictedEvents?.()[0]
    this.head = this.ctx.screenPos(ahead ?? e)
    this.request()
    return true
  }

  up(e: PointerEvent): boolean {
    if (e.pointerId !== this.pointerId) return false
    this.pointerId = null
    this.head = null
    this.request()
    return true
  }

  clear(): void {
    this.trail = []
    this.pointerId = null
    this.head = null
    this.request()
  }

  private add(e: { clientX: number; clientY: number }, start: boolean): void {
    const screen = this.ctx.screenPos(e)
    const c = this.ctx.camera()
    this.trail.push({
      x: (screen.x - c.offsetX) / c.zoom,
      y: (screen.y - c.offsetY) / c.zoom,
      t: performance.now(),
      start,
    })
  }

  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    this.trail = this.trail.filter((p) => now - p.t < FADE_MS)
    const c = this.ctx.camera()
    const sx = (p: TrailPoint) => p.x * c.zoom + c.offsetX
    const sy = (p: TrailPoint) => p.y * c.zoom + c.offsetY
    // Flat ends: round ones would overlap where two pieces meet and show as darker beads.
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = this.color
    for (const [width, alpha] of [
      [GLOW_PX, 0.22],
      [CORE_PX, 1],
    ] as const) {
      ctx.lineWidth = width
      // Points close in age share one path, so a long trail is a handful of strokes.
      for (let i = 1; i < this.trail.length;) {
        const life = 1 - (now - this.trail[i]!.t) / FADE_MS
        // Stays bright for most of its life, then fades quickly.
        ctx.globalAlpha = Math.sqrt(Math.max(0, life)) * alpha
        ctx.beginPath()
        ctx.moveTo(sx(this.trail[i - 1]!), sy(this.trail[i - 1]!))
        const until = this.trail[i]!.t + FADE_MS / 12
        for (; i < this.trail.length && this.trail[i]!.t <= until; i++) {
          const p = this.trail[i]!
          if (p.start) ctx.moveTo(sx(p), sy(p))
          else ctx.lineTo(sx(p), sy(p))
        }
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    if (this.head) {
      const last = this.trail[this.trail.length - 1]
      // The line runs right up to the broom's head.
      if (last) {
        ctx.lineCap = 'round'
        ctx.lineWidth = CORE_PX
        ctx.beginPath()
        ctx.moveTo(sx(last), sy(last))
        ctx.lineTo(this.head.x, this.head.y)
        ctx.stroke()
      }
      drawBroom(ctx, this.head.x, this.head.y, BROOM_PX, this.color)
    }
    return this.trail.length > 0 || this.head !== null
  }
}
