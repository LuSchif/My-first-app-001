import { headAt } from '../geometry/arrows.ts'
import { enterBox } from '../geometry/box.ts'
import { graphTextPlaces, tickHalf } from '../model/graph.ts'
import type { GraphObject } from '../model/types.ts'
import { strokeBoxOutline } from './outline.ts'
import { FONT_STACKS } from './text.ts'

/** The ticks of one axis: every `step` from the origin in direction `dir`, up to `reach`. */
function ticksAlong(
  path: Path2D,
  dir: { x: number; y: number },
  reach: number,
  step: number,
  half: number,
): void {
  if (!(step > 0.5) || reach <= 0) return
  // Across the axis.
  const nx = -dir.y
  const ny = dir.x
  for (let d = step; d <= reach + 1e-6; d += step) {
    const x = dir.x * d
    const y = dir.y * d
    path.moveTo(x - nx * half, y - ny * half)
    path.lineTo(x + nx * half, y + ny * half)
  }
}

/** Draws a graph: its axes and heads, ticks, the axes' names and its title. */
export function paintGraph(ctx: CanvasRenderingContext2D, g: GraphObject): void {
  ctx.save()
  enterBox(ctx, g)
  if (g.outline) strokeBoxOutline(ctx, g.width, g.height, g.outline)
  ctx.translate(g.originX, g.originY)
  ctx.strokeStyle = g.color
  ctx.fillStyle = g.color
  ctx.lineWidth = g.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const path = new Path2D()
  path.moveTo(g.left, 0)
  path.lineTo(g.right, 0)
  path.moveTo(0, g.bottom)
  path.lineTo(0, g.top)
  const head = (tip: { x: number; y: number }, dir: { x: number; y: number }) => {
    const h = headAt(tip, dir, g.headSize)
    path.moveTo(h[0]!, h[1]!)
    path.lineTo(h[2]!, h[3]!)
    path.lineTo(h[4]!, h[5]!)
  }
  head({ x: g.right, y: 0 }, { x: 1, y: 0 })
  head({ x: 0, y: g.top }, { x: 0, y: -1 })
  const depth = g.depth
  let depthDir: { x: number; y: number } | null = null
  if (depth) {
    path.moveTo(depth.fromX, depth.fromY)
    path.lineTo(depth.toX, depth.toY)
    const l = Math.hypot(depth.toX - depth.fromX, depth.toY - depth.fromY) || 1
    depthDir = { x: (depth.toX - depth.fromX) / l, y: (depth.toY - depth.fromY) / l }
    if (depth.head) head({ x: depth.toX, y: depth.toY }, depthDir)
  }

  if (g.ticks.show) {
    const half = tickHalf(g)
    // Ticks stop short of the heads, so they never run into them.
    const clear = g.headSize * 1.1
    ticksAlong(path, { x: 1, y: 0 }, g.right - clear, g.ticks.x, half)
    ticksAlong(path, { x: -1, y: 0 }, -g.left - half, g.ticks.x, half)
    ticksAlong(path, { x: 0, y: -1 }, -g.top - clear, g.ticks.y, half)
    ticksAlong(path, { x: 0, y: 1 }, g.bottom - half, g.ticks.y, half)
    if (depth && depthDir) {
      const toward = Math.hypot(depth.toX, depth.toY) - (depth.head ? clear : half)
      const away = Math.hypot(depth.fromX, depth.fromY) - half
      ticksAlong(path, depthDir, toward, g.ticks.z, half)
      ticksAlong(path, { x: -depthDir.x, y: -depthDir.y }, away, g.ticks.z, half)
    }
  }
  ctx.stroke(path)

  const places = graphTextPlaces(g)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `400 ${g.fontSize}px ${FONT_STACKS.hand}`
  if (g.labels.x) ctx.fillText(g.labels.x, places.x.x, places.x.y)
  if (g.labels.y) ctx.fillText(g.labels.y, places.y.x, places.y.y)
  if (g.labels.z && places.z) ctx.fillText(g.labels.z, places.z.x, places.z.y)
  if (g.title) {
    ctx.font = `700 ${g.fontSize * 1.2}px ${FONT_STACKS.hand}`
    ctx.fillText(g.title, places.title.x, places.title.y)
  }
  ctx.restore()
}
