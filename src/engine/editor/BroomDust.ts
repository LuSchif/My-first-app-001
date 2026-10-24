import type { Point } from '../geometry/camera.ts'
import type { FxPainter } from './FxLayer.ts'

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
  color: string
}

const MAX_MOTES = 260
const DUST = ['#c9b29a', '#b98b65', '#ddd0bf']

/**
 * Little puffs of dust where the broom sweeps something away: specks of the swept ink and of
 * paper dust fly off in the direction of the sweep, slow down and fade.
 */
export class BroomDust implements FxPainter {
  private motes: Mote[] = []

  /** A puff at a screen point; `dx`, `dy` is the sweep's direction, `color` the swept ink. */
  puff(at: Point, dx: number, dy: number, color: string, size: number): void {
    const now = performance.now()
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const count = Math.min(10, 3 + Math.round(size / 8))
    for (let i = 0; i < count; i++) {
      // Mostly ahead of the broom and a little upward, spread over a wide angle.
      const spread = (Math.random() - 0.5) * 2.2
      const cos = Math.cos(spread)
      const sin = Math.sin(spread)
      const speed = 0.05 + Math.random() * 0.12
      this.motes.push({
        x: at.x + (Math.random() - 0.5) * size * 0.6,
        y: at.y + (Math.random() - 0.5) * size * 0.6,
        vx: (ux * cos - uy * sin) * speed,
        vy: (ux * sin + uy * cos) * speed - 0.04,
        born: now,
        life: 380 + Math.random() * 420,
        size: 0.8 + Math.random() * 2.2,
        color: Math.random() < 0.45 ? color : DUST[i % DUST.length]!,
      })
    }
    if (this.motes.length > MAX_MOTES) this.motes.splice(0, this.motes.length - MAX_MOTES)
  }

  paint(ctx: CanvasRenderingContext2D, now: number): boolean {
    this.motes = this.motes.filter((m) => now - m.born < m.life)
    for (const m of this.motes) {
      const age = now - m.born
      const t = age / m.life
      // Drag slows each speck; a touch of gravity lets it settle.
      const travel = (1 - Math.exp(-age / 260)) * 260
      const x = m.x + m.vx * travel
      const y = m.y + m.vy * travel + 0.00003 * age * age
      ctx.globalAlpha = (1 - t) * (1 - t) * 0.9
      ctx.fillStyle = m.color
      ctx.beginPath()
      ctx.arc(x, y, m.size * (1 - t * 0.4), 0, Math.PI * 2)
      ctx.fill()
    }
    return this.motes.length > 0
  }
}
