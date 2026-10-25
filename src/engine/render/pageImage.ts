import { PAGE_SIZE, type LayerDef, type Page, type PageSize } from '../model/types.ts'
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
  size: PageSize = PAGE_SIZE,
): void {
  ctx.save()
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.fillStyle = page.background ?? background ?? PAPER_STYLE.paper
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.beginPath()
  ctx.rect(0, 0, size.width, size.height)
  ctx.clip()
  drawPaper(ctx, page.paper, scale, size)
  paintLayers(ctx, page.objects, layers, null)
  ctx.restore()
}

/** A page as a canvas of its own, `scale` pixels per point. */
export function renderPage(
  page: Page,
  layers: readonly LayerDef[],
  scale: number,
  background?: string,
  size: PageSize = PAGE_SIZE,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size.width * scale)
  canvas.height = Math.round(size.height * scale)
  drawPage(canvas.getContext('2d')!, page, layers, scale, background, size)
  return canvas
}
