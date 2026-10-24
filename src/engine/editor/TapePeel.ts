import type { Camera } from '../geometry/camera.ts'
import type { StrokeObject } from '../model/types.ts'
import { enterPage } from '../render/SceneRenderer.ts'
import { paintTape } from '../render/strokes.ts'
import type { FxPainter } from './FxLayer.ts'

const PEEL_MS = 420

interface Peel {
  tape: StrokeObject
  pageIndex: number
  start: number
  /** Peeling off (revealing) or sticking back on. */
  reveal: boolean
  done?: () => void
}

/**
 * Tape being pulled off or stuck back on: the covered part shrinks toward the far end, lifting
 * and fading a little as it goes, or grows back from the near end.
 */
export class TapePeel implements FxPainter {
  private peels: Peel[] = []
  private readonly camera: () => Camera
  private readonly dpr: () => number

  constructor(camera: () => Camera, dpr: () => number) {
    this.camera = camera
    this.dpr = dpr
  }

  add(tape: StrokeObject, pageIndex: number, reveal: boolean, done?: () => void): void {
    this.peels.push({
      tape,
      pageIndex,
      start: performance.now(),
      reveal,
      ...(done ? { done } : {}),
    })
  }

  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    const finished = this.peels.filter((p) => now - p.start >= PEEL_MS)
    this.peels = this.peels.filter((p) => now - p.start < PEEL_MS)
    for (const p of finished) p.done?.()
    for (const p of this.peels) {
      const t = (now - p.start) / PEEL_MS
      const eased = 1 - Math.pow(1 - t, 3)
      const pts = p.tape.points
      const n = pts.length / 2
      const [x0, y0, x1, y1] = [pts[0]!, pts[1]!, pts[(n - 1) * 2]!, pts[(n - 1) * 2 + 1]!]
      const mx = x0 + (x1 - x0) * eased
      const my = y0 + (y1 - y0) * eased
      const covered = p.reveal ? [mx, my, x1, y1] : [x0, y0, mx, my]
      ctx.save()
      enterPage(ctx, this.camera(), this.dpr(), p.pageIndex)
      if (p.reveal) {
        // The loose end lifts off the paper: a shadow under a slightly raised strip.
        ctx.translate(0, -3 * Math.sin(t * Math.PI))
      }
      const piece: StrokeObject = { ...p.tape, points: covered, revealed: false, straight: true }
      paintTape(ctx, piece, p.reveal ? 1 - t * 0.5 : 0.6 + t * 0.4)
      ctx.restore()
    }
    return this.peels.length > 0
  }
}
