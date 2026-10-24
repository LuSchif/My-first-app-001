import { PAGE_SIZE, type LayerDef, type Page } from '../model/types.ts'
import { loadImage } from './images.ts'
import { paintLayers } from './layers.ts'
import { drawPaper, PAPER_STYLE } from './paper.ts'

/** Loads every picture on these pages, so a drawing of them is complete. */
export async function preloadPictures(pages: readonly Page[]): Promise<void> {
  const ids = new Set<string>()
  for (const page of pages) {
    for (const o of page.objects) if (o.type === 'image') ids.add(o.assetId)
  }
  await Promise.all([...ids].map(loadImage))
}

/** Draws a whole page (paper, then every visible layer) at `scale` pixels per point. */
export function drawPage(
  ctx: CanvasRenderingContext2D,
  page: Page,
  layers: readonly LayerDef[],
  scale: number,
  background?: string,
): void {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = page.background ?? background ?? PAPER_STYLE.paper
  ctx.fillRect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
  ctx.beginPath()
  ctx.rect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
  ctx.clip()
  drawPaper(ctx, page.paper, scale)
  paintLayers(ctx, page.objects, layers, null)
  ctx.restore()
}

/** A page as a canvas of its own, `scale` pixels per point. */
export function renderPage(
  page: Page,
  layers: readonly LayerDef[],
  scale: number,
  background?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PAGE_SIZE.width * scale)
  canvas.height = Math.round(PAGE_SIZE.height * scale)
  drawPage(canvas.getContext('2d')!, page, layers, scale, background)
  return canvas
}
