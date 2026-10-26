import type { Camera } from '../geometry/camera.ts'
import type { LayerDef, Page } from '../model/types.ts'
import type { PageLayout } from './layout.ts'
import { paintLayers } from './layers.ts'
import { drawPaper, PAPER_STYLE } from './paper.ts'

/**
 * Finished pages as pictures. Drawing a page with thousands of strokes takes a while; drawing
 * its picture takes almost nothing, so panning and zooming stay smooth however full a notebook
 * is. A picture belongs to one state of its page (objects, layers, paper, background) and one
 * zoom: when the page changes it is no longer used; when only the zoom changes it is shown
 * scaled (slightly soft) until a sharp one is made, a moment after the zoom settles.
 *
 * The cache only reads pages; it never changes what is stored. Pages too large for a picture
 * at the current zoom are drawn directly, as before.
 */

/** The largest picture made of one page, in device pixels (about 64 MB). */
const MAX_PIXELS = 16_000_000
/** Pictures kept at once; the least recently shown goes first. */
const MAX_PAGES = 8

interface Entry {
  canvas: HTMLCanvasElement
  objects: Page['objects']
  layers: readonly LayerDef[]
  paper: Page['paper']
  pageBackground: string | undefined
  background: string | undefined
  /** Device pixels per point the picture was made at. */
  scale: number
  /** Where the page's corner fell inside a device pixel when it was made. */
  fx: number
  fy: number
}

export type CacheResult = 'sharp' | 'soft' | 'none'

export class PageCache {
  private readonly entries = new Map<string, Entry>()

  /** Forgets every picture, e.g. after a picture or font finished loading. */
  clear(): void {
    this.entries.clear()
  }

  /**
   * Draws page `index` from its picture, if there is one for the page as it is now. Returns
   * 'sharp' when it matched the zoom exactly, 'soft' when it was scaled, 'none' when the page
   * must be drawn directly (and a picture made later).
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
  ): CacheResult {
    const entry = this.entries.get(page.id)
    if (!entry || !this.matches(entry, page, layers, background)) return 'none'
    // Recently shown pictures stay longest.
    this.entries.delete(page.id)
    this.entries.set(page.id, entry)
    const scale = camera.zoom * dpr
    const { x, y } = devicePos(camera, dpr, layout, index)
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const same =
      Math.abs(entry.scale - scale) < 1e-6 &&
      Math.abs(entry.fx - frac(x)) < 0.01 &&
      Math.abs(entry.fy - frac(y)) < 0.01
    if (same) {
      ctx.drawImage(entry.canvas, Math.floor(x), Math.floor(y))
    } else {
      const k = scale / entry.scale
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(
        entry.canvas,
        x - entry.fx * k,
        y - entry.fy * k,
        entry.canvas.width * k,
        entry.canvas.height * k,
      )
    }
    ctx.restore()
    return same ? 'sharp' : 'soft'
  }

  /** Makes the picture of page `index` for the current zoom (skipped when it would be too big). */
  build(
    page: Page,
    index: number,
    layers: readonly LayerDef[],
    background: string | undefined,
    camera: Camera,
    dpr: number,
    layout: PageLayout,
  ): void {
    const scale = camera.zoom * dpr
    const { width, height } = layout.size
    const { x, y } = devicePos(camera, dpr, layout, index)
    const fx = frac(x)
    const fy = frac(y)
    const w = Math.ceil(width * scale + fx)
    const h = Math.ceil(height * scale + fy)
    if (w * h > MAX_PIXELS || w <= 0 || h <= 0) {
      this.entries.delete(page.id)
      return
    }
    const old = this.entries.get(page.id)
    const canvas = old?.canvas ?? document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, fx, fy)
    ctx.fillStyle = page.background ?? background ?? PAPER_STYLE.paper
    ctx.fillRect(0, 0, width, height)
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    ctx.clip()
    drawPaper(ctx, page.paper, camera.zoom, layout.size)
    paintLayers(ctx, page.objects, layers, null)
    this.entries.delete(page.id)
    this.entries.set(page.id, {
      canvas,
      objects: page.objects,
      layers,
      paper: page.paper,
      pageBackground: page.background,
      background,
      scale,
      fx,
      fy,
    })
    while (this.entries.size > MAX_PAGES) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  private matches(
    entry: Entry,
    page: Page,
    layers: readonly LayerDef[],
    background: string | undefined,
  ): boolean {
    return (
      entry.objects === page.objects &&
      entry.layers === layers &&
      entry.paper === page.paper &&
      entry.pageBackground === page.background &&
      entry.background === background
    )
  }
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
