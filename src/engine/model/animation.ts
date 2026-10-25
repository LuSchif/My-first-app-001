import type { Rect } from '../geometry/rect.ts'
import type { CanvasObject, Id, ObjectAnimation, SlideTransition } from './types.ts'

/**
 * Presenting a slide: objects with an animation appear in steps. A step starts with an object
 * set to start "on tap"; objects set to "with" join the step and start at the same time as the
 * one before, objects set to "after" start when the one before has finished. Animated objects
 * before the first "on tap" play right when the slide comes in.
 */

export interface StepItem {
  id: Id
  effect: ObjectAnimation['effect']
  /** From the start of the step, in milliseconds. */
  delay: number
  duration: number
}

export interface SlideSteps {
  /** Plays when the slide comes in (may be empty). */
  entry: StepItem[]
  /** One per tap. */
  taps: StepItem[][]
}

export const DEFAULT_ANIMATION: ObjectAnimation = {
  effect: 'fade',
  start: 'tap',
  order: 0,
  duration: 500,
}

export const DEFAULT_TRANSITION: SlideTransition = { effect: 'fade', duration: 500 }

/** The animated objects of a slide, in their order. */
export function animated(objects: readonly CanvasObject[]): CanvasObject[] {
  return objects.filter((o) => o.animation).sort((a, b) => a.animation!.order - b.animation!.order)
}

export function slideSteps(objects: readonly CanvasObject[]): SlideSteps {
  const entry: StepItem[] = []
  const taps: StepItem[][] = []
  let current = entry
  let lastStart = 0
  let lastEnd = 0
  for (const o of animated(objects)) {
    const a = o.animation!
    if (a.start === 'tap') {
      current = []
      taps.push(current)
      lastStart = 0
      lastEnd = 0
    }
    const delay = a.start === 'after' ? lastEnd : lastStart
    current.push({ id: o.id, effect: a.effect, delay, duration: a.duration })
    lastStart = delay
    lastEnd = delay + a.duration
  }
  return { entry, taps }
}

/** How long a step takes until its last object has fully appeared. */
export function stepLength(items: readonly StepItem[]): number {
  return Math.max(0, ...items.map((i) => i.delay + i.duration))
}

/** A gentle ease out: fast start, soft landing. */
export function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - c, 3)
}

/**
 * Draws an object at progress `t` (0 = not yet there, 1 = in place) of its entrance. `paint`
 * draws it in place; `bounds` is where it ends up, `page` the slide's size.
 */
export function paintEntrance(
  ctx: CanvasRenderingContext2D,
  effect: ObjectAnimation['effect'],
  t: number,
  bounds: Rect,
  page: { width: number; height: number },
  paint: () => void,
): void {
  if (t <= 0) return
  if (t >= 1) {
    paint()
    return
  }
  const e = ease(t)
  ctx.save()
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  if (effect === 'fade') ctx.globalAlpha *= e
  else if (effect === 'rise') {
    ctx.globalAlpha *= e
    ctx.translate(0, (1 - e) * 40)
  } else if (effect === 'fly-left') ctx.translate(-(1 - e) * (bounds.maxX + 20), 0)
  else if (effect === 'fly-right') ctx.translate((1 - e) * (page.width - bounds.minX + 20), 0)
  else if (effect === 'zoom') {
    ctx.globalAlpha *= e
    const s = 0.5 + 0.5 * e
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.translate(-cx, -cy)
  } else if (effect === 'wipe') {
    ctx.beginPath()
    ctx.rect(
      bounds.minX - 2,
      bounds.minY - 2,
      (bounds.maxX - bounds.minX + 4) * e,
      bounds.maxY - bounds.minY + 4,
    )
    ctx.clip()
  }
  paint()
  ctx.restore()
}

/**
 * Draws the change from one slide (`from`, a picture of it) to the next (`to`) at progress
 * `t`, filling the rectangle (x, y, w, h).
 */
export function paintTransition(
  ctx: CanvasRenderingContext2D,
  effect: SlideTransition['effect'],
  t: number,
  from: CanvasImageSource,
  to: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const e = ease(t)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  if (effect === 'fade') {
    ctx.drawImage(from, x, y, w, h)
    ctx.globalAlpha = e
    ctx.drawImage(to, x, y, w, h)
  } else if (effect === 'push') {
    ctx.drawImage(from, x - e * w, y, w, h)
    ctx.drawImage(to, x + (1 - e) * w, y, w, h)
  } else if (effect === 'cover') {
    ctx.drawImage(from, x, y, w, h)
    ctx.drawImage(to, x + (1 - e) * w, y, w, h)
  } else {
    ctx.drawImage(from, x, y, w, h)
    ctx.globalAlpha = e
    const s = 0.85 + 0.15 * e
    ctx.drawImage(to, x + (w * (1 - s)) / 2, y + (h * (1 - s)) / 2, w * s, h * s)
  }
  ctx.restore()
}
