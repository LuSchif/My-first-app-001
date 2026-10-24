import { intersects, type Rect } from '../geometry/rect.ts'
import type { CanvasObject, LayerDef } from '../model/types.ts'
import { paintBounds, paintObject } from './objects.ts'

/** A layer and the layers clipped to it (clipping masks), bottom to top. */
interface LayerGroup {
  base: LayerDef
  clipped: LayerDef[]
}

/**
 * Groups layers for drawing. A layer marked as a clipping mask shows only where the nearest
 * unclipped layer below it has content, like in Procreate; a hidden base hides its group.
 */
export function layerGroups(layers: readonly LayerDef[]): LayerGroup[] {
  const groups: LayerGroup[] = []
  for (const layer of layers) {
    const last = groups[groups.length - 1]
    if (layer.clip && last) last.clipped.push(layer)
    else groups.push({ base: layer, clipped: [] })
  }
  return groups
}

/**
 * Paints a page's objects layer by layer onto `ctx`, which is already in page coordinates.
 * Objects outside `area` (page coordinates) and in `hidden` are skipped.
 */
export function paintLayers(
  ctx: CanvasRenderingContext2D,
  objects: readonly CanvasObject[],
  layers: readonly LayerDef[],
  area: Rect | null,
  hidden: ReadonlySet<string> = new Set(),
): void {
  const on = (layer: LayerDef) =>
    objects.filter(
      (o) =>
        o.layerId === layer.id && !hidden.has(o.id) && (!area || intersects(paintBounds(o), area)),
    )
  for (const { base, clipped } of layerGroups(layers)) {
    if (!base.visible || base.opacity <= 0) continue
    const baseObjects = on(base)
    if (baseObjects.length === 0) continue
    const masks = clipped
      .filter((l) => l.visible && l.opacity > 0)
      .map((layer) => ({ layer, objects: on(layer) }))
      .filter((m) => m.objects.length > 0)

    if (masks.length === 0 && base.opacity >= 1) {
      for (const object of baseObjects) paintObject(ctx, object)
      continue
    }
    // The group is drawn on its own canvas: clipped layers only where the base has ink, then
    // the whole group is faded by the base's opacity, so overlaps do not show through.
    const group = scratch(0, ctx)
    for (const object of baseObjects) paintObject(group, object)
    for (const { layer, objects: layerObjects } of masks) {
      const piece = scratch(1, ctx)
      for (const object of layerObjects) paintObject(piece, object)
      group.save()
      group.setTransform(1, 0, 0, 1, 0, 0)
      group.globalCompositeOperation = 'source-atop'
      group.globalAlpha = layer.opacity
      group.drawImage(piece.canvas, 0, 0)
      group.restore()
    }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = base.opacity
    ctx.drawImage(group.canvas, 0, 0)
    ctx.restore()
  }
}

const scratches: (CanvasRenderingContext2D | null)[] = [null, null]

/** A cleared offscreen canvas the size of `like`, with the same transform. */
function scratch(slot: 0 | 1, like: CanvasRenderingContext2D): CanvasRenderingContext2D {
  let ctx = scratches[slot]
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!
    scratches[slot] = ctx
  }
  const { width, height } = like.canvas
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = width
    ctx.canvas.height = height
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(like.getTransform())
  return ctx
}
