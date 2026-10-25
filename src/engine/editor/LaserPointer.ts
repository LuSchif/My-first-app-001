import type { Point } from '../geometry/camera.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import type { EditorContext } from './context.ts'
import type { FxPainter } from './FxLayer.ts'

/** The whole drawing stays this long after the pen last moved, then fades out together. */
const HOLD_MS = 3000
const FADE_MS = 450
const CORE_PX = 4
const GLOW_PX = 14
const BROOM_PX = 44

interface TrailPoint {
  /** World coordinates, so the trail stays on the page while it scrolls. */
  x: number
  y: number
  t: number
  /** Starts a new line (a new touch-down). */
  start: boolean
}

/**
 * Points at things while presenting: a glowing line in the laser color, led by a broom of the
 * same color. Everything drawn stays in full until the pen has rested for three seconds, then
 * fades out at once. It never changes the notebook.
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
  /** When the pen last drew. */
  private lastActive = 0

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
    this.lastActive = performance.now()
  }

  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    if (this.pointerId !== null) this.lastActive = now
    const idle = now - this.lastActive - HOLD_MS
    if (idle >= FADE_MS) this.trail = []
    const fade = idle > 0 ? 1 - idle / FADE_MS : 1
    const c = this.ctx.camera()
    const sx = (p: TrailPoint) => p.x * c.zoom + c.offsetX
    const sy = (p: TrailPoint) => p.y * c.zoom + c.offsetY
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = this.color
    // One path for the whole drawing: glow below, bright core on top.
    const path = new Path2D()
    for (const p of this.trail) {
      if (p.start) path.moveTo(sx(p), sy(p))
      else path.lineTo(sx(p), sy(p))
    }
    if (this.head && this.trail.length) path.lineTo(this.head.x, this.head.y)
    for (const [width, alpha] of [
      [GLOW_PX, 0.22],
      [CORE_PX, 1],
    ] as const) {
      ctx.globalAlpha = alpha * fade
      ctx.lineWidth = width
      ctx.stroke(path)
    }
    ctx.globalAlpha = 1
    if (this.head) drawBroom(ctx, this.head.x, this.head.y, BROOM_PX, this.color)
    return this.trail.length > 0 || this.head !== null
  }
}
