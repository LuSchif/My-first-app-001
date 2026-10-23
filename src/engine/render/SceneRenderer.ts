import type { Camera } from '../geometry/camera.ts'
import { intersects, type Rect } from '../geometry/rect.ts'
import { PAGE_SIZE, type LayerDef, type Page } from '../model/types.ts'
import { pageOrigin } from './layout.ts'
import { drawPaper, PAPER_STYLE } from './paper.ts'
import { objectBounds, paintObject } from './objects.ts'

export const DESK_COLOR = '#ede4d8'

export interface View {
  width: number
  height: number
  dpr: number
}

export function applyCamera(ctx: CanvasRenderingContext2D, camera: Camera, dpr: number): void {
  const z = camera.zoom * dpr
  ctx.setTransform(z, 0, 0, z, camera.offsetX * dpr, camera.offsetY * dpr)
}

/** Sets the transform to page coordinates of the given page and clips to the paper. */
export function enterPage(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  dpr: number,
  index: number,
): void {
  applyCamera(ctx, camera, dpr)
  const o = pageOrigin(index)
  ctx.translate(o.x, o.y)
  ctx.beginPath()
  ctx.rect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
  ctx.clip()
}

/** The world rectangle the screen currently shows. */
export function visibleWorld(camera: Camera, view: View): Rect {
  return {
    minX: -camera.offsetX / camera.zoom,
    minY: -camera.offsetY / camera.zoom,
    maxX: (view.width - camera.offsetX) / camera.zoom,
    maxY: (view.height - camera.offsetY) / camera.zoom,
  }
}

/** Draws the desk, every visible page with its paper, and the objects of all visible layers. */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  pages: readonly Page[],
  layers: readonly LayerDef[],
  camera: Camera,
  view: View,
  /** Objects drawn elsewhere right now, e.g. a selection being moved or text being edited. */
  hidden: ReadonlySet<string> = new Set(),
): void {
  const { dpr } = view
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = DESK_COLOR
  ctx.fillRect(0, 0, view.width * dpr, view.height * dpr)

  const world = visibleWorld(camera, view)
  pages.forEach((page, index) => {
    const o = pageOrigin(index)
    const rect = { minX: o.x, minY: o.y, maxX: o.x + PAGE_SIZE.width, maxY: o.y + PAGE_SIZE.height }
    if (!intersects(rect, world)) return

    applyCamera(ctx, camera, dpr)
    ctx.save()
    ctx.shadowColor = 'rgba(62, 45, 37, 0.14)'
    ctx.shadowBlur = 18 * dpr
    ctx.shadowOffsetY = 3 * dpr
    ctx.fillStyle = page.background ?? PAPER_STYLE.paper
    ctx.fillRect(o.x, o.y, PAGE_SIZE.width, PAGE_SIZE.height)
    ctx.restore()

    ctx.save()
    enterPage(ctx, camera, dpr, index)
    drawPaper(ctx, page.paper, camera.zoom)
    const local = {
      minX: world.minX - o.x,
      minY: world.minY - o.y,
      maxX: world.maxX - o.x,
      maxY: world.maxY - o.y,
    }
    for (const layer of layers) {
      if (!layer.visible) continue
      for (const object of page.objects) {
        if (object.layerId !== layer.id || hidden.has(object.id)) continue
        if (!intersects(objectBounds(object), local)) continue
        paintObject(ctx, object)
      }
    }
    ctx.restore()
  })
}
