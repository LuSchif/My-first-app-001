import type { Camera } from '../geometry/camera.ts'
import type { Rect } from '../geometry/rect.ts'
import type { LayerDef, Page } from '../model/types.ts'
import type { PageLayout } from './layout.ts'
import { paintLayers } from './layers.ts'
import { drawPaper, PAPER_STYLE } from './paper.ts'

/**
 * Finished pages as pictures, so panning and zooming stay smooth however full a notebook is.
 * Drawing a page with thousands of strokes takes a while; drawing its picture takes almost
 * nothing. Each page has up to three pictures, all for one state of the page (objects, layers,
 * paper, background):
 *
 * - a base picture at a moderate size, made once per state and shown (scaled) while the view
 *   moves, at any zoom;
 * - a sharp picture of the whole page at the current zoom, when it is not too large;
 * - at high zoom, a sharp picture of just the part of the page in view (and a margin).
 *
 * Sharp pictures are made a moment after the view settles, one page at a time, so no frame waits
 * long. The cache only reads pages; it never changes what is stored.
 */

/** The largest sharp picture of a whole page, in device pixels. */
const MAX_PIXELS = 12_000_000
/** The size of a base picture, in device pixels at most. */
const BASE_PIXELS = 3_000_000
/** Pages whose pictures are kept at once; the least recently shown goes first. */
const MAX_PAGES = 10
/** Around the part in view, a sharp region also covers this share of the view on each side. */
const REGION_MARGIN = 0.35

interface Picture {
  canvas: HTMLCanvasElement
  /** Device pixels per point it was made at. */
  scale: number
  /** The part of the page it shows, in page points. */
  area: Rect
  /** Where the area's corner fell inside a device pixel when it was made (sharp pictures). */
  fx: number
  fy: number
}

interface Entry {
  objects: Page['objects']
  layers: readonly LayerDef[]
  paper: Page['paper']
  pageBackground: string | undefined
  background: string | undefined
  base: Picture | null
  sharp: Picture | null
}

export type CacheResult = 'sharp' | 'soft' | 'none'

export interface ViewSize {
  width: number
  height: number
}

export class PageCache {
  private readonly entries = new Map<string, Entry>()

  /** Forgets every picture, e.g. after a picture or font finished loading. */
  clear(): void {
    this.entries.clear()
  }

  /**
   * Draws page `index` from its pictures, if there are any for the page as it is now. Returns
   * 'sharp' when what is in view was drawn at exactly the zoom, 'soft' when it was scaled (or a
   * sharp picture should be made), 'none' when the page must be drawn directly.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    page: Page,
    index: number,
    layers: readonly LayerDef[],
    background: string | undefined,
    camera: Camera,
    dpr: number,
    layout: PageLayout,
    view: ViewSize,
  ): CacheResult {
    const entry = this.current(page, layers, background)
    if (!entry || !entry.base) return 'none'
    // Recently shown pages stay longest.
    this.entries.delete(page.id)
    this.entries.set(page.id, entry)
    const scale = camera.zoom * dpr
    const corner = devicePos(camera, dpr, layout, index)
    const inView = visiblePart(camera, view, layout, index)
    const sharp = entry.sharp
    const exact =
      sharp !== null &&
      Math.abs(sharp.scale - scale) < 1e-6 &&
      covers(sharp.area, inView) &&
      Math.abs(sharp.fx - frac(corner.x + sharp.area.minX * scale)) < 0.01 &&
      Math.abs(sharp.fy - frac(corner.y + sharp.area.minY * scale)) < 0.01
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (exact) {
      ctx.drawImage(
        sharp.canvas,
        Math.floor(corner.x + sharp.area.minX * scale),
        Math.floor(corner.y + sharp.area.minY * scale),
      )
      ctx.restore()
      return 'sharp'
    }
    // While the view moves: the whole page from the base picture, and the sharper picture on
    // top where it reaches, both scaled.
    // Plain smoothing: the frame must be quick, and a sharp picture follows.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'low'
    const sharper = sharp !== null && sharp.scale > entry.base.scale
    if (!sharper || !covers(sharp.area, inView)) blit(ctx, entry.base, corner, scale)
    if (sharper) blit(ctx, sharp, corner, scale)
    ctx.restore()
    return 'soft'
  }

  /** Whether page `index` has a base picture for the page as it is now. */
  hasBase(page: Page, layers: readonly LayerDef[], background: string | undefined): boolean {
    return Boolean(this.current(page, layers, background)?.base)
  }

  /**
   * Makes the pictures page `index` lacks: first a base picture, then (for the current zoom) a
   * sharp one of the whole page, or of the part in view when the whole would be too large.
   * Makes one picture per call; returns whether there is more to make for this page.
   */
  build(
    page: Page,
    index: number,
    layers: readonly LayerDef[],
    background: string | undefined,
    camera: Camera,
    dpr: number,
    layout: PageLayout,
    view: ViewSize,
  ): boolean {
    let entry = this.current(page, layers, background)
    if (!entry) {
      entry = {
        objects: page.objects,
        layers,
        paper: page.paper,
        pageBackground: page.background,
        background,
        base: null,
        sharp: null,
      }
    }
    this.entries.delete(page.id)
    this.entries.set(page.id, entry)
    while (this.entries.size > MAX_PAGES) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }

    const { width, height } = layout.size
    const whole = { minX: 0, minY: 0, maxX: width, maxY: height }
    if (!entry.base) {
      const scale = Math.min(camera.zoom * dpr, Math.sqrt(BASE_PIXELS / (width * height)))
      entry.base = paint(page, layers, background, whole, scale, 0, 0, camera.zoom, layout)
      return true
    }
    const scale = camera.zoom * dpr
    const corner = devicePos(camera, dpr, layout, index)
    const area =
      width * height * scale * scale <= MAX_PIXELS
        ? whole
        : regionAround(visiblePart(camera, view, layout, index), view, camera.zoom, whole)
    if (area.maxX <= area.minX || area.maxY <= area.minY) return false
    const fx = frac(corner.x + area.minX * scale)
    const fy = frac(corner.y + area.minY * scale)
    entry.sharp = paint(
      page,
      layers,
      background,
      area,
      scale,
      fx,
      fy,
      camera.zoom,
      layout,
      entry.sharp,
    )
    return false
  }

  private current(
    page: Page,
    layers: readonly LayerDef[],
    background: string | undefined,
  ): Entry | null {
    const entry = this.entries.get(page.id)
    if (
      !entry ||
      entry.objects !== page.objects ||
      entry.layers !== layers ||
      entry.paper !== page.paper ||
      entry.pageBackground !== page.background ||
      entry.background !== background
    ) {
      return null
    }
    return entry
  }
}

/** Draws a part of a page into a picture at `scale` device pixels per point. */
function paint(
  page: Page,
  layers: readonly LayerDef[],
  background: string | undefined,
  area: Rect,
  scale: number,
  fx: number,
  fy: number,
  zoom: number,
  layout: PageLayout,
  reuse?: Picture | null,
): Picture {
  const canvas = reuse?.canvas ?? document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil((area.maxX - area.minX) * scale + fx))
  canvas.height = Math.max(1, Math.ceil((area.maxY - area.minY) * scale + fy))
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, fx - area.minX * scale, fy - area.minY * scale)
  const { width, height } = layout.size
  ctx.fillStyle = page.background ?? background ?? PAPER_STYLE.paper
  ctx.fillRect(0, 0, width, height)
  ctx.beginPath()
  ctx.rect(area.minX, area.minY, area.maxX - area.minX, area.maxY - area.minY)
  ctx.clip()
  drawPaper(ctx, page.paper, zoom, layout.size)
  paintLayers(ctx, page.objects, layers, area)
  return { canvas, scale, area, fx, fy }
}

/** Draws a picture scaled to the current zoom, where its area lies on the page. */
function blit(
  ctx: CanvasRenderingContext2D,
  picture: Picture,
  corner: { x: number; y: number },
  scale: number,
): void {
  const k = scale / picture.scale
  ctx.drawImage(
    picture.canvas,
    corner.x + picture.area.minX * scale - picture.fx * k,
    corner.y + picture.area.minY * scale - picture.fy * k,
    picture.canvas.width * k,
    picture.canvas.height * k,
  )
}

/** The part of page `index` on screen, in page points (may be empty). */
function visiblePart(camera: Camera, view: ViewSize, layout: PageLayout, index: number): Rect {
  const o = layout.origin(index)
  const { width, height } = layout.size
  return {
    minX: Math.max(0, -camera.offsetX / camera.zoom - o.x),
    minY: Math.max(0, -camera.offsetY / camera.zoom - o.y),
    maxX: Math.min(width, (view.width - camera.offsetX) / camera.zoom - o.x),
    maxY: Math.min(height, (view.height - camera.offsetY) / camera.zoom - o.y),
  }
}

/** The part in view with a margin around it, kept inside the page. */
function regionAround(part: Rect, view: ViewSize, zoom: number, page: Rect): Rect {
  const mx = (view.width / zoom) * REGION_MARGIN
  const my = (view.height / zoom) * REGION_MARGIN
  return {
    minX: Math.max(page.minX, part.minX - mx),
    minY: Math.max(page.minY, part.minY - my),
    maxX: Math.min(page.maxX, part.maxX + mx),
    maxY: Math.min(page.maxY, part.maxY + my),
  }
}

function covers(outer: Rect, inner: Rect): boolean {
  if (inner.maxX <= inner.minX || inner.maxY <= inner.minY) return true
  return (
    outer.minX <= inner.minX + 1e-6 &&
    outer.minY <= inner.minY + 1e-6 &&
    outer.maxX >= inner.maxX - 1e-6 &&
    outer.maxY >= inner.maxY - 1e-6
  )
}

/** The page's top left corner in device pixels. */
function devicePos(
  camera: Camera,
  dpr: number,
  layout: PageLayout,
  index: number,
): { x: number; y: number } {
  const o = layout.origin(index)
  return {
    x: (o.x * camera.zoom + camera.offsetX) * dpr,
    y: (o.y * camera.zoom + camera.offsetY) * dpr,
  }
}

function frac(v: number): number {
  return v - Math.floor(v)
}
