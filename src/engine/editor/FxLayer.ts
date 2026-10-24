import type { View } from '../render/SceneRenderer.ts'

/** Something drawn on the effects layer each frame. Returns whether it needs another frame. */
export interface FxPainter {
  paint(ctx: CanvasRenderingContext2D, now: number): boolean
}

/**
 * A canvas of its own for short-lived effects (the laser trail, broom dust). One animation loop
 * redraws all of them and stops as soon as nothing moves, so it costs nothing while idle.
 */
export class FxLayer {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly painters: FxPainter[] = []
  private frame = 0

  private readonly view: () => View

  constructor(canvas: HTMLCanvasElement, view: () => View) {
    this.canvas = canvas
    this.view = view
    // desynchronized asks for a low-latency path where the browser has one.
    this.ctx = canvas.getContext('2d', { desynchronized: true })!
  }

  add(painter: FxPainter): void {
    this.painters.push(painter)
  }

  /** Draws on the next frame, and keeps drawing while any effect is still moving. */
  request(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame((now) => {
      this.frame = 0
      const { width, height, dpr } = this.view()
      const ctx = this.ctx
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, width * dpr, height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      let more = false
      for (const p of this.painters) {
        ctx.save()
        if (p.paint(ctx, now)) more = true
        ctx.restore()
      }
      // The last frame draws nothing and leaves the canvas empty.
      if (more) this.request()
    })
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.canvas.remove()
  }
}
