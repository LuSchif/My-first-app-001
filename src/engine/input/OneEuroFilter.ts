/**
 * The 1€ filter (Casiez et al., 2012): strong smoothing when the pen moves slowly, where jitter
 * is visible, and almost none when it moves fast, where lag would be visible.
 */
export class OneEuroFilter {
  private value: number | null = null
  private speed = 0
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number

  constructor(minCutoff: number, beta: number, dCutoff = 1) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  /** `dt` in seconds. */
  filter(x: number, dt: number): number {
    if (this.value === null) {
      this.value = x
      return x
    }
    const rawSpeed = (x - this.value) / dt
    this.speed += alpha(dt, this.dCutoff) * (rawSpeed - this.speed)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.speed)
    this.value += alpha(dt, cutoff) * (x - this.value)
    return this.value
  }
}

function alpha(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}
