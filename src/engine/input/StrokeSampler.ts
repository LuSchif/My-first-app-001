/**
 * Turns raw pointer samples (screen pixels) into the points of a stroke. Raw stylus input needs
 * a little care: on iPadOS a sample can arrive late or twice, share a time stamp with others, or
 * sit a fraction of a pixel from the previous one; those are dropped or spaced out here.
 *
 * The points then pass a 1€ filter (Casiez et al.): a low-pass filter whose cutoff rises with
 * the pen's speed. Moving slowly, the hand and sensor wobble shows most and lag matters least,
 * so it smooths strongly; moving fast, it lets the samples through almost as they are, so the
 * line never trails. The line is always drawn on to the actual pen tip, and the finished stroke
 * ends exactly where the pen lifted.
 */

/** Closer samples than this (px) add nothing but noise to the curve. */
const MIN_STEP = 0.5
const FALLBACK_SAMPLE_MS = 1000 / 240 // Apple Pencil reports at 240 Hz
/** 1€ filter: the cutoff (Hz) while the pen is still, ... */
const MIN_CUTOFF = 10
/** ... how much it rises per pixel per second of speed, ... */
const BETA = 0.05
/** ... and the cutoff for the speed estimate itself. */
const SPEED_CUTOFF = 10
/** Raw samples kept for estimating where the pen goes next. */
const RECENT = 12

export interface ScreenSample {
  x: number
  y: number
  /** Event time stamp in ms. */
  t: number
  /** Pen pressure from 0 to 1; 0.5 when the device does not report it. */
  p: number
  /** Pen tilt where the device reports it: altitude and azimuth in radians. */
  tilt?: Tilt
}

export interface Tilt {
  /** π/2 when the pen stands upright, smaller as it leans over. */
  altitude: number
  azimuth: number
}

export class StrokeSampler {
  /** Accepted samples in screen pixels: the points of the stroke. */
  readonly points: ScreenSample[] = []
  /** The latest sample, accepted or not: the actual pen tip. */
  tip: ScreenSample | null = null
  filtered = 0
  received = 0

  private lastStamp = -Infinity
  private lastTime = -Infinity
  /** The 1€ filter's state: its position and its smoothed velocity (px/s). */
  private fx = 0
  private fy = 0
  private vx = 0
  private vy = 0
  private readonly recent: ScreenSample[] = []

  /** Returns true when the sample became a new point of the stroke. */
  add(x: number, y: number, timeStamp: number, pressure = 0.5, tilt?: Tilt): boolean {
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
    this.lastStamp = timeStamp
    this.lastTime = t

    const sample: ScreenSample = tilt ? { x, y, t, p: pressure, tilt } : { x, y, t, p: pressure }
    const previous = this.tip
    this.tip = sample
    this.recent.push(sample)
    if (this.recent.length > RECENT) this.recent.shift()
    const last = this.points[this.points.length - 1]
    if (!last || !previous) {
      this.fx = x
      this.fy = y
      this.points.push(sample)
      return true
    }
    const dt = Math.max(0.5, t - previous.t) / 1000
    const dAlpha = alpha(SPEED_CUTOFF, dt)
    this.vx += ((x - this.fx) / dt - this.vx) * dAlpha
    this.vy += ((y - this.fy) / dt - this.vy) * dAlpha
    const a = alpha(MIN_CUTOFF + BETA * Math.hypot(this.vx, this.vy), dt)
    this.fx += (x - this.fx) * a
    this.fy += (y - this.fy) * a
    const point = { ...sample, x: this.fx, y: this.fy }
    if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_STEP) {
      this.filtered++
      return false
    }
    this.points.push(point)
    return true
  }

  /**
   * Where the pen will likely be `aheadMs` from its last sample, at most `maxPx` away: the recent
   * velocity carried forward, and less of it while the pen turns, since a straight guess
   * overshoots a curve. Null when the pen is (nearly) still.
   */
  predict(aheadMs: number, maxPx: number): { x: number; y: number } | null {
    const r = this.recent
    const tip = this.tip
    if (!tip || r.length < 4) return null
    const mid = r[r.length - 3]!
    const old = r[Math.max(0, r.length - 6)]!
    const dt1 = tip.t - mid.t
    const dt0 = mid.t - old.t
    if (dt1 <= 0 || dt0 <= 0) return null
    const vx = (tip.x - mid.x) / dt1
    const vy = (tip.y - mid.y) / dt1
    const speed = Math.hypot(vx, vy)
    if (speed < 0.05) return null
    const ox = (mid.x - old.x) / dt0
    const oy = (mid.y - old.y) / dt0
    const oldSpeed = Math.hypot(ox, oy)
    // 1 going straight on, 0 at a right angle or sharper.
    const straight = oldSpeed > 0 ? Math.max(0, (vx * ox + vy * oy) / (speed * oldSpeed)) : 0
    const d = Math.min(maxPx, speed * aheadMs * straight * straight)
    if (d < 0.5) return null
    return { x: tip.x + (vx / speed) * d, y: tip.y + (vy / speed) * d }
  }

  /** The pen's recent speed in px per ms (0 when unknown). */
  speed(): number {
    const r = this.recent
    const tip = this.tip
    const from = r[Math.max(0, r.length - 4)]
    if (!tip || !from || tip.t <= from.t) return 0
    return Math.hypot(tip.x - from.x, tip.y - from.y) / (tip.t - from.t)
  }

  /** The stroke's points, ending exactly where the pen lifted. */
  finalPoints(): ScreenSample[] {
    const last = this.points[this.points.length - 1]
    const tip = this.tip
    if (last && tip && tip !== last && (tip.x !== last.x || tip.y !== last.y)) {
      return [...this.points, tip]
    }
    return this.points
  }
}

/** The smoothing factor of a low-pass filter with `cutoff` Hz for a step of `dt` seconds. */
function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}
