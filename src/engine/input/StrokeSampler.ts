import { OneEuroFilter } from './OneEuroFilter.ts'

/** Tuned on iPad Pro with Apple Pencil in work package 0 (spikes/ink-test.html). */
const SMOOTHING = { minCutoff: 4, beta: 0.03 }
const MIN_STEP = 0.75 // px; closer samples add only noise
const MAX_BACKTRACK = 4 // px; shorter reversals are sensor jitter, not handwriting
const FALLBACK_SAMPLE_MS = 1000 / 240 // Apple Pencil reports at 240 Hz
const PREDICT_WINDOW_MS = 24
const PREDICT_MAX_PX = 18

export interface ScreenSample {
  x: number
  y: number
  /** Event time stamp in ms. */
  t: number
}

/**
 * Turns raw pointer samples (screen pixels) into a clean stroke. Raw stylus input is not clean:
 * on iPadOS a sample can arrive late or twice, share a time stamp with others, or sit a fraction
 * of a pixel from the previous one. Each of those is filtered here, then jitter is smoothed.
 */
export class StrokeSampler {
  /** Accepted, smoothed samples in screen pixels. */
  readonly points: ScreenSample[] = []
  /** The latest raw position: the actual pen tip, which the smoothed line trails slightly. */
  tip: ScreenSample | null = null
  filtered = 0
  received = 0

  private readonly fx = new OneEuroFilter(SMOOTHING.minCutoff, SMOOTHING.beta)
  private readonly fy = new OneEuroFilter(SMOOTHING.minCutoff, SMOOTHING.beta)
  private readonly raw: ScreenSample[] = []
  private lastStamp = -Infinity
  private lastTime = -Infinity

  /** Returns true when a new smoothed point was added. */
  add(x: number, y: number, timeStamp: number): boolean {
    this.received++
    if (timeStamp < this.lastStamp) {
      this.filtered++
      return false
    }
    // Some browsers give all samples of one frame the same time stamp; space those evenly.
    const t =
      timeStamp > this.lastStamp
        ? Math.max(timeStamp, this.lastTime + 1)
        : this.lastTime + FALLBACK_SAMPLE_MS
    const dt = this.lastTime === -Infinity ? FALLBACK_SAMPLE_MS / 1000 : (t - this.lastTime) / 1000
    this.lastStamp = timeStamp
    this.lastTime = t

    this.tip = { x, y, t }
    this.raw.push(this.tip)
    if (this.raw.length > 32) this.raw.shift()

    const p = { x: this.fx.filter(x, dt), y: this.fy.filter(y, dt), t }
    const n = this.points.length
    const last = this.points[n - 1]
    if (last) {
      const dx = p.x - last.x
      const dy = p.y - last.y
      const dist = Math.hypot(dx, dy)
      if (dist < MIN_STEP) {
        this.filtered++
        return false
      }
      const prev = this.points[n - 2]
      if (prev && dist < MAX_BACKTRACK && (last.x - prev.x) * dx + (last.y - prev.y) * dy < 0) {
        this.filtered++
        return false
      }
    }
    this.points.push(p)
    return true
  }

  /** Where the pen will be `aheadMs` from now, extrapolated from its recent velocity. */
  predict(aheadMs: number): { x: number; y: number } | null {
    const last = this.raw[this.raw.length - 1]
    if (!last) return null
    let from: ScreenSample | undefined
    for (let i = this.raw.length - 2; i >= 0; i--) {
      from = this.raw[i]
      if (from && last.t - from.t >= PREDICT_WINDOW_MS) break
    }
    if (!from || last.t <= from.t) return null
    let dx = ((last.x - from.x) / (last.t - from.t)) * aheadMs
    let dy = ((last.y - from.y) / (last.t - from.t)) * aheadMs
    const len = Math.hypot(dx, dy)
    if (len < 0.5) return null
    if (len > PREDICT_MAX_PX) {
      dx *= PREDICT_MAX_PX / len
      dy *= PREDICT_MAX_PX / len
    }
    return { x: last.x + dx, y: last.y + dy }
  }

  /** Smoothed points, ending exactly where the pen lifted. */
  finalPoints(): ScreenSample[] {
    const last = this.points[this.points.length - 1]
    const tip = this.tip
    if (last && tip && Math.hypot(tip.x - last.x, tip.y - last.y) >= MIN_STEP) {
      return [...this.points, tip]
    }
    return this.points
  }
}
