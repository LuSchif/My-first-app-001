import type { Point } from '../geometry/camera.ts'
import { drawBroom } from '../render/broomGlyph.ts'
import type { EditorContext } from './context.ts'

/** How long the trail stays visible behind the pointer. */
const FADE_MS = 900
const TRAIL_PX = 5

interface TrailPoint {
  /** World coordinates, so the trail stays on the page while it scrolls. */
  x: number
  y: number
  t: number
  /** Starts a new line (a new touch-down). */
  start: boolean
}

/**
 * Points at things while presenting: a glowing line that follows the pen and fades away, led by
 * a small broom. It never changes the notebook.
 */
export class LaserPointer {
  private readonly ctx: EditorContext
  color = '#e0533f'
  private trail: TrailPoint[] = []
  private pointerId: number | null = null
  private head: Point | null = null
  private frame = 0

  constructor(ctx: EditorContext) {
    this.ctx = ctx
  }

  get busy(): boolean {
    return this.pointerId !== null
  }

  down(e: PointerEvent): void {
    this.pointerId = e.pointerId
    this.add(e, true)
  }

  move(e: PointerEvent): boolean {
    if (e.pointerId !== this.pointerId) return false
    const events = e.getCoalescedEvents?.() ?? []
    for (const ev of events.length ? events : [e]) this.add(ev, false)
    return true
  }

  up(e: PointerEvent): boolean {
    if (e.pointerId !== this.pointerId) return false
    this.pointerId = null
    this.head = null
    this.schedule()
    return true
  }

  clear(): void {
    this.trail = []
    this.pointerId = null
    this.head = null
    this.draw(performance.now())
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
    this.head = screen
    this.schedule()
  }

  private schedule(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0
      this.draw(now)
      if (this.trail.length > 0 || this.head) this.schedule()
    })
  }

  private draw(now: number): void {
    const ctx = this.ctx.overlay
    const { width, height, dpr } = this.ctx.view()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width * dpr, height * dpr)
    this.trail = this.trail.filter((p) => now - p.t < FADE_MS)
    const c = this.ctx.camera()
    const screen = (p: TrailPoint) => ({ x: p.x * c.zoom + c.offsetX, y: p.y * c.zoom + c.offsetY })

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (let i = 1; i < this.trail.length; i++) {
      const p = this.trail[i]!
      if (p.start) continue
      const a = screen(this.trail[i - 1]!)
      const b = screen(p)
      const life = 1 - (now - p.t) / FADE_MS
      ctx.globalAlpha = Math.max(0, life)
      // A soft glow under a bright core.
      ctx.strokeStyle = this.color
      ctx.lineWidth = TRAIL_PX * (0.5 + life * 0.5)
      ctx.shadowColor = this.color
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    if (this.head) {
      ctx.beginPath()
      ctx.arc(this.head.x, this.head.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = this.color
      ctx.shadowColor = this.color
      ctx.shadowBlur = 18
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(this.head.x, this.head.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#fffcf7'
      ctx.fill()
      drawBroom(ctx, this.head.x + 18, this.head.y - 18, 28)
    }
  }
}
