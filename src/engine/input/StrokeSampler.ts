/**
 * Turns raw pointer samples (screen pixels) into the points of a stroke. Raw stylus input needs
 * a little care: on iPadOS a sample can arrive late or twice, share a time stamp with others, or
 * sit a fraction of a pixel from the previous one; those are dropped or spaced out here.
 *
 * Each point is then pulled halfway from the previous point towards the new sample
 * ("streamline", as in most note apps): tiny wobbles of the hand and sensor even out, while the
 * points stay about one sample behind the pen, a fraction of a millimetre. The line is always
 * drawn on to the actual pen tip, and the finished stroke ends exactly where the pen lifted, so
 * nothing ever trails visibly.
 */

/** Closer samples than this (px) add nothing but noise to the curve. */
const MIN_STEP = 0.5
/** How far each point moves towards the new sample: 1 takes samples as they are. */
const STREAMLINE = 0.5
const FALLBACK_SAMPLE_MS = 1000 / 240 // Apple Pencil reports at 240 Hz

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
    this.tip = sample
    const last = this.points[this.points.length - 1]
    if (!last) {
      this.points.push(sample)
      return true
    }
    const point = {
      ...sample,
      x: last.x + (x - last.x) * STREAMLINE,
      y: last.y + (y - last.y) * STREAMLINE,
    }
    if (Math.hypot(point.x - last.x, point.y - last.y) < MIN_STEP) {
      this.filtered++
      return false
    }
    this.points.push(point)
    return true
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
