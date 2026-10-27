import type { Point } from '../geometry/camera.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import type { EditorContext } from './context.ts'
import type { FxPainter } from './FxLayer.ts'

/** The whole drawing stays this long after the pen last moved, then fades out together. */
const HOLD_MS = 1000
const FADE_MS = 450
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
 * Points at things while presenting: a glowing line in the laser color, led by a broom of the
 * same color. Everything drawn stays in full until the pen has rested for a second, then
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
  private glow: HTMLCanvasElement | null = null

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

  private glowCanvas(width: number, height: number): HTMLCanvasElement {
    this.glow ??= document.createElement('canvas')
    if (this.glow.width !== width) this.glow.width = width
    if (this.glow.height !== height) this.glow.height = height
    return this.glow
  }

  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    if (this.pointerId !== null) this.lastActive = now
    const idle = now - this.lastActive - HOLD_MS
    if (idle >= FADE_MS) this.trail = []
    const fade = idle > 0 ? 1 - idle / FADE_MS : 1
    const c = this.ctx.camera()
    const sx = (p: TrailPoint) => p.x * c.zoom + c.offsetX
    const sy = (p: TrailPoint) => p.y * c.zoom + c.offsetY
    // One smooth path for the whole drawing: curves through the midpoints between samples.
    const path = new Path2D()
    let prev: { x: number; y: number } | null = null
    for (const p of this.trail) {
      const q = { x: sx(p), y: sy(p) }
      if (p.start || !prev) path.moveTo(q.x, q.y)
      else path.quadraticCurveTo(prev.x, prev.y, (prev.x + q.x) / 2, (prev.y + q.y) / 2)
      prev = q
    }
    if (prev) path.lineTo(this.head?.x ?? prev.x, this.head?.y ?? prev.y)
    // The glow is drawn opaque on a canvas of its own and laid over once at its strength:
    // translucent strokes straight on the page darken where their pieces overlap (dots).
    const glow = this.glowCanvas(ctx.canvas.width, ctx.canvas.height)
    const g = glow.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, glow.width, glow.height)
    g.setTransform(ctx.getTransform())
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = this.color
    g.lineWidth = GLOW_PX
    g.stroke(path)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 0.22 * fade
    ctx.drawImage(glow, 0, 0)
    ctx.restore()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = this.color
    ctx.globalAlpha = fade
    ctx.lineWidth = CORE_PX
    ctx.stroke(path)
    ctx.globalAlpha = 1
    if (this.head) drawBroom(ctx, this.head.x, this.head.y, BROOM_PX, this.color)
    return this.trail.length > 0 || this.head !== null
  }
}
