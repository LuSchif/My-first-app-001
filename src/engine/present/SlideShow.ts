import { paintEntrance, paintTransition, slideSteps, stepLength } from '../model/animation.ts'
import type { StepItem } from '../model/animation.ts'
import type { CanvasObject, LayerDef, Page, PageSize, SlideTransition } from '../model/types.ts'
import { objectBounds, paintObject } from '../render/objects.ts'
import { drawPage } from '../render/pageImage.ts'

/** Where the slide show is: which slide, and how far its animations have come. */
export interface ShowPosition {
  slide: number
  /** Steps played on this slide: 0 is its entry, then one per tap. */
  step: number
  /** True after the last slide: a dark screen that ends the show on the next tap. */
  ended: boolean
}

interface Transition {
  effect: SlideTransition['effect']
  start: number
  duration: number
  /** The slide that is going away, as it last looked. */
  from: HTMLCanvasElement
}

/**
 * Plays a presentation: slide by slide, the animated objects of each slide in steps (see
 * `slideSteps`), with each slide's transition. `next` and `back` move through it; `draw`
 * paints the moment `now` onto a canvas of any size, with the slide fitted in the middle.
 */
export class SlideShow {
  private readonly pages: readonly Page[]
  private readonly layers: readonly LayerDef[]
  private readonly background: string | undefined
  private readonly size: PageSize
  private steps: StepItem[][] = []
  private slide = 0
  private step = 0
  /** When the current step started; -Infinity once it should show as finished. */
  private stepStart = -Infinity
  private transition: Transition | null = null
  private ended = false
  private scale = 1
  private readonly picture = document.createElement('canvas')

  constructor(
    pages: readonly Page[],
    layers: readonly LayerDef[],
    background: string | undefined,
    size: PageSize,
    start: number,
    now: number,
  ) {
    this.pages = pages
    this.layers = layers
    this.background = background
    this.size = size
    this.enter(Math.max(0, Math.min(pages.length - 1, start)), now)
  }

  get position(): ShowPosition {
    return { slide: this.slide, step: this.step, ended: this.ended }
  }

  get slideCount(): number {
    return this.pages.length
  }

  /** The next step, or the next slide when this one is complete. */
  next(now: number): void {
    if (this.ended) return
    if (this.busy(now)) {
      this.finish()
      return
    }
    if (this.step < this.steps.length - 1) {
      this.step++
      this.stepStart = now
      return
    }
    if (this.slide >= this.pages.length - 1) {
      this.ended = true
      return
    }
    const from = this.snapshot()
    this.enter(this.slide + 1, now)
    const t = this.pages[this.slide]?.transition
    if (t) {
      this.transition = { effect: t.effect, start: now, duration: t.duration, from }
      this.stepStart = now + t.duration
    }
  }

  /** One step back; at a slide's start, the slide before as it ends. */
  back(): void {
    if (this.ended) {
      this.ended = false
      return
    }
    this.transition = null
    if (this.step > 0) {
      this.step--
      this.stepStart = -Infinity
      return
    }
    if (this.slide === 0) return
    this.enter(this.slide - 1, -Infinity)
    this.step = this.steps.length - 1
  }

  goTo(slide: number, now: number): void {
    this.ended = false
    this.enter(Math.max(0, Math.min(this.pages.length - 1, slide)), now)
  }

  /** Whether anything is still moving at `now` (so more frames are needed). */
  busy(now: number): boolean {
    if (this.transition && now < this.transition.start + this.transition.duration) return true
    return now < this.stepStart + stepLength(this.steps[this.step] ?? [])
  }

  /**
   * Paints the show at `now` onto `ctx` (in device pixels), the slide as large as fits, on
   * `backdrop`.
   */
  draw(ctx: CanvasRenderingContext2D, now: number, backdrop: string): void {
    const { width, height } = ctx.canvas
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = backdrop
    ctx.fillRect(0, 0, width, height)
    if (this.ended) {
      ctx.restore()
      return
    }
    this.scale = Math.min(width / this.size.width, height / this.size.height)
    const w = Math.round(this.size.width * this.scale)
    const h = Math.round(this.size.height * this.scale)
    const x = Math.round((width - w) / 2)
    const y = Math.round((height - h) / 2)
    const slide = this.render(this.picture, now)
    const t = this.transition
    if (t && now < t.start + t.duration) {
      paintTransition(ctx, t.effect, (now - t.start) / t.duration, t.from, slide, x, y, w, h)
    } else {
      this.transition = null
      ctx.drawImage(slide, x, y, w, h)
    }
    ctx.restore()
  }

  /** Starts slide `slide` at `now`: its entry animations play from then. */
  private enter(slide: number, now: number): void {
    const { entry, taps } = slideSteps(this.pages[slide]?.objects ?? [])
    this.slide = slide
    this.steps = [entry, ...taps]
    this.step = 0
    this.stepStart = now
    this.transition = null
  }

  /** Shows the current step as finished. */
  private finish(): void {
    this.stepStart = -Infinity
    this.transition = null
  }

  /** How far object `id` has come into the slide at `now`, from 0 to 1. */
  private progress(id: string, now: number): { item: StepItem; t: number } | null {
    for (let s = 0; s < this.steps.length; s++) {
      const item = this.steps[s]!.find((i) => i.id === id)
      if (!item) continue
      if (s < this.step) return { item, t: 1 }
      if (s > this.step) return { item, t: 0 }
      return { item, t: (now - this.stepStart - item.delay) / item.duration }
    }
    return null
  }

  /** The current slide at `now`, drawn into `canvas` at the show's scale. */
  private render(canvas: HTMLCanvasElement, now: number): HTMLCanvasElement {
    const w = Math.max(1, Math.round(this.size.width * this.scale))
    const h = Math.max(1, Math.round(this.size.height * this.scale))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    const page = this.pages[this.slide]
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, w, h)
    if (!page) return canvas
    const paint = (target: CanvasRenderingContext2D, object: CanvasObject) => {
      const p = object.animation ? this.progress(object.id, now) : null
      if (!p) {
        paintObject(target, object)
        return
      }
      paintEntrance(target, p.item.effect, p.t, objectBounds(object), this.size, () =>
        paintObject(target, object),
      )
    }
    drawPage(ctx, page, this.layers, this.scale, this.background, this.size, paint)
    return canvas
  }

  /** A still copy of the current slide, as it looks finished. */
  private snapshot(): HTMLCanvasElement {
    this.finish()
    return this.render(document.createElement('canvas'), Infinity)
  }
}
