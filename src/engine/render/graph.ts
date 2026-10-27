import { headAt } from '../geometry/arrows.ts'
import { enterBox } from '../geometry/box.ts'
import { graphTextPlaces, tickSize, type GraphAxis } from '../model/graph.ts'
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
  /** Leaves out ticks closer to the origin than this (on a slanted axis, near the others). */
  from = 0,
): void {
  if (!(step > 0.5) || reach <= 0) return
  // Across the axis.
  const nx = -dir.y
  const ny = dir.x
  for (let d = step; d <= reach + 1e-6; d += step) {
    const x = dir.x * d
    const y = dir.y * d
    const ax = x - nx * half
    const ay = y - ny * half
    const bx = x + nx * half
    const by = y + ny * half
    if (d < from) continue
    path.moveTo(ax, ay)
    path.lineTo(bx, by)
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

  ctx.stroke(path)

  if (g.ticks.show) {
    // Ticks stop short of the heads, so they never run into them. Each axis has its own size.
    const clear = g.headSize * 1.1
    const draw = (axis: GraphAxis, add: (ticks: Path2D, half: number) => void) => {
      const size = tickSize(g, axis)
      if (!(size.length > 0) || !(size.width > 0)) return
      const ticks = new Path2D()
      add(ticks, size.length / 2)
      ctx.lineWidth = size.width
      ctx.stroke(ticks)
    }
    draw('x', (ticks, half) => {
      ticksAlong(ticks, { x: 1, y: 0 }, g.right - clear, g.ticks.x, half)
      ticksAlong(ticks, { x: -1, y: 0 }, -g.left - half, g.ticks.x, half)
    })
    draw('y', (ticks, half) => {
      ticksAlong(ticks, { x: 0, y: -1 }, -g.top - clear, g.ticks.y, half)
      ticksAlong(ticks, { x: 0, y: 1 }, g.bottom - half, g.ticks.y, half)
    })
    if (depth && depthDir) {
      const dir = depthDir
      // Near the origin the slanted axis's ticks would run into the others' ticks.
      const others = Math.max(tickSize(g, 'x').length, tickSize(g, 'y').length) / 2
      draw('z', (ticks, half) => {
        const from = (others + half) * 1.2 + g.lineWidth
        const toward = Math.hypot(depth.toX, depth.toY) - (depth.head ? clear : half)
        const away = Math.hypot(depth.fromX, depth.fromY) - half
        ticksAlong(ticks, dir, toward, g.ticks.z, half, from)
        ticksAlong(ticks, { x: -dir.x, y: -dir.y }, away, g.ticks.z, half, from)
      })
    }
  }

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
