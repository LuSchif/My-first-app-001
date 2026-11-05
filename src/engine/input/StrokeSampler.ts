/**
 * Turns raw pointer samples (screen pixels) into the points of a stroke. Raw stylus input needs
 * a little care: on iPadOS a sample can arrive late or twice, share a time stamp with others, or
 * sit a fraction of a pixel from the previous one; those are dropped or spaced out here.
 *
 * The points then pass a 1€ filter (Casiez et al.): a low-pass filter whose cutoff rises with
 * the pen's speed. Moving slowly, the hand and sensor wobble shows most and lag matters least,
 * so it smooths strongly; moving fast, it lets the samples through almost as they are, so the
 * line never trails. Then a short rope (see `DEFAULT_STABILIZATION`) takes out what is left. The line is always drawn on to the actual pen tip, and the finished stroke
 * ends exactly where the pen lifted.
 */

/** Closer samples than this (px) add nothing but noise to the curve. */
const MIN_STEP = 0.5
const FALLBACK_SAMPLE_MS = 1000 / 240 // Apple Pencil reports at 240 Hz
/**
 * How steady lines are made, from 0 (samples almost as they come) through 1 (strong) to
 * `MAX_STABILIZATION` (very calm: small details round off and the line trails the pen more).
 * It sets the 1€ filter below, a short "rope" that the line follows only once the pen pulls it
 * taut, and an easing by distance, so the tremor of a slow hand and the sensor's pixel steps
 * never reach the line.
 */
export const DEFAULT_STABILIZATION = 1.4
export const MAX_STABILIZATION = 2
/** Each setting at stabilization 0, 1 and 2; in between it changes evenly. */
/** 1€ filter: the cutoff (Hz) while the pen is still, ... */
const MIN_CUTOFF = [14, 0.5, 0.25] as const
/** ... how much it rises per pixel per second of speed, ... */
const BETA = [0.06, 0.03, 0.018] as const
/** ... and the cutoff for the speed estimate itself. */
const SPEED_CUTOFF = 10
/** The rope's length in screen pixels. */
const ROPE_PX = [0, 2, 3.5] as const
/** The line eases towards the rope's end over this much of its own length (screen pixels), ... */
const EASE_PX = [0, 2.5, 6] as const
/** ... and keeps its points this far apart (px), so the curve between them is calm. */
const MIN_STEPS = [MIN_STEP, MIN_STEP + 1, MIN_STEP + 2] as const
/**
 * With stabilization, the line is the pen's actual positions smoothed both ways along it, as
 * it is written: a Gaussian over this much of its length (sigma, screen pixels). Being
 * symmetric, it does not trail and leaves no hook at the ends; a point is final once the pen is
 * three sigma further on, and the line never changes after the pen lifts.
 */
const FINISH_SIGMA = [0, 6, 16] as const
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
  /** Why samples were not kept: arrived after a later one, repeated a position, or too close. */
  late = 0
  repeats = 0
  tooClose = 0

  private lastStamp = -Infinity
  private lastTime = -Infinity
  /** The 1€ filter's state: its position and its smoothed velocity (px/s). */
  private fx = 0
  private fy = 0
  private vx = 0
  private vy = 0
  private readonly recent: ScreenSample[] = []
  /** The end of the rope: where the line is. */
  private rx = 0
  private ry = 0
  private readonly minCutoff: number
  private readonly beta: number
  private readonly rope: number
  private readonly ease: number
  private readonly minStep: number
  /** The line's eased position, following the rope's end. */
  private sx = 0
  private sy = 0
  readonly stabilization: number
  /** See `FINISH_SIGMA`. */
  readonly finishSigma: number
  /** Where the pen actually was for each point (x, y), before any filter. */
  private readonly rawAt: number[] = []

  constructor(stabilization = DEFAULT_STABILIZATION) {
    const k = Math.min(MAX_STABILIZATION, Math.max(0, stabilization))
    this.stabilization = k
    this.minCutoff = level(MIN_CUTOFF, k)
    this.beta = level(BETA, k)
    this.rope = level(ROPE_PX, k)
    this.ease = level(EASE_PX, k)
    this.finishSigma = level(FINISH_SIGMA, k)
    this.minStep = level(MIN_STEPS, k)
  }

  /** Returns true when the sample became a new point of the stroke. */
  add(x: number, y: number, timeStamp: number, pressure = 0.5, tilt?: Tilt): boolean {
    this.received++
    if (timeStamp < this.lastStamp) {
      this.filtered++
      this.late++
      return false
    }
    // A repeat of the last position (Safari sends many) is no movement: fed to the filter it
    // would read as the pen stopping and starting, and the line would go in straight jumps.
    if (this.tip && x === this.tip.x && y === this.tip.y) {
      this.filtered++
      this.repeats++
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
      this.rx = x
      this.ry = y
      this.sx = x
      this.sy = y
      this.points.push(sample)
      this.rawAt.push(x, y)
      return true
    }
    const dt = Math.max(0.5, t - previous.t) / 1000
    const dAlpha = alpha(SPEED_CUTOFF, dt)
    this.vx += ((x - this.fx) / dt - this.vx) * dAlpha
    this.vy += ((y - this.fy) / dt - this.vy) * dAlpha
    const a = alpha(this.minCutoff + this.beta * Math.hypot(this.vx, this.vy), dt)
    this.fx += (x - this.fx) * a
    this.fy += (y - this.fy) * a
    // The rope: the line moves only by as much as the filtered pen is further than its length.
    const d = Math.hypot(this.fx - this.rx, this.fy - this.ry)
    if (d > this.rope) {
      const k = (d - this.rope) / d
      this.rx += (this.fx - this.rx) * k
      this.ry += (this.fy - this.ry) * k
    }
    if (d > this.rope && this.ease > 0) {
      // Eased by the distance moved, not by time: as calm when slow as when fast.
      const k = 1 - Math.exp(-(d - this.rope) / this.ease)
      this.sx += (this.rx - this.sx) * k
      this.sy += (this.ry - this.sy) * k
    } else if (this.ease === 0) {
      this.sx = this.rx
      this.sy = this.ry
    }
    const point = { ...sample, x: this.sx, y: this.sy }
    if (Math.hypot(point.x - last.x, point.y - last.y) < this.minStep) {
      this.filtered++
      this.tooClose++
      return false
    }
    this.points.push(point)
    this.rawAt.push(x, y)
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
    // Velocities over a few samples each: one sample to the next is mostly sensor noise.
    const mid = r[Math.max(1, r.length - 5)]!
    const old = r[Math.max(0, r.length - 9)]!
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

  /** Where the steadied line is now, between its last point and the pen (screen pixels). */
  steady(): { x: number; y: number } | null {
    return this.tip ? { x: this.sx, y: this.sy } : null
  }

  /** The pen's recent speed in px per ms (0 when unknown). */
  speed(): number {
    const r = this.recent
    const tip = this.tip
    const from = r[Math.max(0, r.length - 4)]
    if (!tip || !from || tip.t <= from.t) return 0
    return Math.hypot(tip.x - from.x, tip.y - from.y) / (tip.t - from.t)
  }

  /** Where the pen actually was for the newest point (screen pixels). */
  lastRaw(): { x: number; y: number } {
    const n = this.rawAt.length
    return { x: this.rawAt[n - 2]!, y: this.rawAt[n - 1]! }
  }

  /**
   * Where the pen actually was at each point of `finalPoints` (x, y pairs, screen pixels), for
   * the smoothing when it lifts.
   */
  finalRawPoints(): number[] {
    const tip = this.tip
    if (this.finalPoints().length > this.points.length && tip) return [...this.rawAt, tip.x, tip.y]
    return this.rawAt.slice()
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

/** A setting at stabilization `k`, from its values at 0, 1 and 2. */
function level(values: readonly [number, number, number], k: number): number {
  return k <= 1
    ? values[0] + (values[1] - values[0]) * k
    : values[1] + (values[2] - values[1]) * (k - 1)
}
