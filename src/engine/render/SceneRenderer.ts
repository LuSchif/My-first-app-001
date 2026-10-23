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
      if (!layer.visible || layer.opacity <= 0) continue
      const objects = page.objects.filter(
        (o) => o.layerId === layer.id && !hidden.has(o.id) && intersects(objectBounds(o), local),
      )
      if (objects.length === 0) continue
      if (layer.opacity >= 1) {
        for (const object of objects) paintObject(ctx, object)
        continue
      }
      // A see-through layer is drawn as a whole and then faded, so overlapping strokes on it
      // do not show through each other.
      const scratch = scratchContext(ctx.canvas.width, ctx.canvas.height)
      scratch.setTransform(1, 0, 0, 1, 0, 0)
      scratch.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height)
      scratch.setTransform(ctx.getTransform())
      for (const object of objects) paintObject(scratch, object)
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = layer.opacity
      ctx.drawImage(scratch.canvas, 0, 0)
      ctx.restore()
    }
    ctx.restore()
  })
}

let scratch: CanvasRenderingContext2D | null = null

function scratchContext(width: number, height: number): CanvasRenderingContext2D {
  if (!scratch) scratch = document.createElement('canvas').getContext('2d')!
  if (scratch.canvas.width !== width || scratch.canvas.height !== height) {
    scratch.canvas.width = width
    scratch.canvas.height = height
  }
  return scratch
}
