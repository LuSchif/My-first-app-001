import type { CleanGraph } from '../geometry/graphs.ts'
import type { GraphObject, Id } from './types.ts'

/** Ticks this long across their axis, in widths of the line (and a few points more). */
const TICK_REACH = 1.6
const TICK_EXTRA = 3

/** Half the length of a tick, so every tick of a graph is the same size. */
export function tickHalf(graph: Pick<GraphObject, 'lineWidth'>): number {
  return graph.lineWidth * TICK_REACH + TICK_EXTRA
}

export type GraphAxis = 'x' | 'y' | 'z'

/** How long and thick one axis's ticks are. */
export function tickSize(g: GraphObject, axis: GraphAxis): { length: number; width: number } {
  return g.tickSizes?.[axis] ?? { length: tickHalf(g) * 2, width: g.lineWidth }
}

/** The longest tick's half, for room around the axes. */
function longestTickHalf(g: GraphObject): number {
  return Math.max(...(['x', 'y', 'z'] as const).map((a) => tickSize(g, a).length / 2))
}

/** A tick spacing that gives about six ticks along the shorter axis, in whole points. */
export function defaultTickSpacing(length: number): number {
  return Math.max(6, Math.round(length / 6))
}

type Pt = { x: number; y: number }

/** Where the depth axis's name goes: just past its lower end, beyond the head. */
function depthLabelAt(g: GraphObject): Pt | null {
  const d = g.depth
  if (!d) return null
  const l = Math.hypot(d.toX - d.fromX, d.toY - d.fromY) || 1
  const reach = g.headSize * 0.4 + g.fontSize * 0.7
  return {
    x: d.toX + ((d.toX - d.fromX) / l) * reach,
    y: d.toY + ((d.toY - d.fromY) / l) * reach + g.fontSize * 0.35,
  }
}

/**
 * Where each piece of text sits, relative to the origin (the text's middle, on its baseline's
 * height for one line): the axes' names next to their heads, the title above the graph.
 */
export function graphTextPlaces(g: GraphObject): {
  x: Pt
  y: Pt
  z: Pt | null
  title: Pt
} {
  const fs = g.fontSize
  return {
    x: { x: g.right - fs * 0.2, y: g.headSize + fs * 0.9 },
    y: { x: -(g.headSize + fs * 0.6), y: g.top + fs * 0.4 },
    z: depthLabelAt(g),
    title: { x: (g.left + g.right) / 2, y: g.top - g.headSize - fs * 0.8 },
  }
}

/** A rough width of a text, without measuring it (the frame only needs room for it). */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.55
}

/**
 * The graph with its frame fitted around everything it shows. The origin keeps its place on the
 * page, also when the graph is turned.
 */
export function fitGraphFrame(g: GraphObject): GraphObject {
  const pad = g.headSize + g.lineWidth + longestTickHalf(g)
  let minX = Math.min(g.left, 0) - pad
  let maxX = Math.max(g.right, 0) + pad
  let minY = Math.min(g.top, 0) - pad
  let maxY = Math.max(g.bottom, 0) + pad
  const take = (p: Pt, w: number, h: number) => {
    minX = Math.min(minX, p.x - w / 2)
    maxX = Math.max(maxX, p.x + w / 2)
    minY = Math.min(minY, p.y - h)
    maxY = Math.max(maxY, p.y + h * 0.4)
  }
  if (g.depth) {
    for (const p of [
      { x: g.depth.fromX, y: g.depth.fromY },
      { x: g.depth.toX, y: g.depth.toY },
    ]) {
      take(p, pad * 2, pad)
      maxY = Math.max(maxY, p.y + pad)
    }
  }
  const places = graphTextPlaces(g)
  const fs = g.fontSize
  if (g.labels.x) take(places.x, textWidth(g.labels.x, fs), fs)
  if (g.labels.y) take(places.y, textWidth(g.labels.y, fs), fs)
  if (g.labels.z && places.z) take(places.z, textWidth(g.labels.z, fs), fs)
  if (g.title) take(places.title, textWidth(g.title, fs * 1.2), fs * 1.2)

  // The origin's place on the page now, which stays.
  const cx = g.x + g.width / 2
  const cy = g.y + g.height / 2
  const cos = Math.cos(g.rotation)
  const sin = Math.sin(g.rotation)
  const ox = g.originX - g.width / 2
  const oy = g.originY - g.height / 2
  const originPage = { x: cx + ox * cos - oy * sin, y: cy + ox * sin + oy * cos }

  const width = maxX - minX
  const height = maxY - minY
  const originX = -minX
  const originY = -minY
  const nx = originX - width / 2
  const ny = originY - height / 2
  const center = {
    x: originPage.x - (nx * cos - ny * sin),
    y: originPage.y - (nx * sin + ny * cos),
  }
  return {
    ...g,
    originX,
    originY,
    width,
    height,
    x: center.x - width / 2,
    y: center.y - height / 2,
  }
}

/** A graph object for clean axes, in the color and width they were drawn with. */
export function graphFromAxes(
  id: Id,
  layerId: Id,
  axes: CleanGraph['axes'],
  ink: { color: string; width: number },
  /** On grid paper: one square, so the ticks sit on the paper's lines. */
  tickSpacing?: number,
): GraphObject {
  const { origin } = axes
  const shorter = Math.min(axes.right - origin.x, origin.y - axes.top)
  const spacing = tickSpacing ?? defaultTickSpacing(Math.max(12, shorter))
  const graph: GraphObject = {
    id,
    type: 'graph',
    layerId,
    color: ink.color,
    lineWidth: ink.width,
    headSize: axes.headSize,
    // Placed by fitGraphFrame from where the origin is on the page.
    x: origin.x,
    y: origin.y,
    width: 0,
    height: 0,
    rotation: 0,
    originX: 0,
    originY: 0,
    left: axes.left - origin.x,
    right: axes.right - origin.x,
    top: axes.top - origin.y,
    bottom: axes.bottom - origin.y,
    ...(axes.depth
      ? {
          depth: {
            fromX: axes.depth.from.x - origin.x,
            fromY: axes.depth.from.y - origin.y,
            toX: axes.depth.to.x - origin.x,
            toY: axes.depth.to.y - origin.y,
            head: axes.depth.head,
          },
        }
      : {}),
    ticks: { show: false, x: spacing, y: spacing, z: spacing },
    labels: { x: '', y: '', z: '' },
    title: '',
    fontSize: Math.max(18, ink.width * 6),
  }
  return fitGraphFrame(graph)
}

/** The graph grown or shrunk as a whole: its axes, lines, ticks and text. */
export function scaleGraph(g: GraphObject, k: number): GraphObject {
  return {
    ...g,
    lineWidth: g.lineWidth * k,
    headSize: g.headSize * k,
    originX: g.originX * k,
    originY: g.originY * k,
    left: g.left * k,
    right: g.right * k,
    top: g.top * k,
    bottom: g.bottom * k,
    ...(g.depth
      ? {
          depth: {
            ...g.depth,
            fromX: g.depth.fromX * k,
            fromY: g.depth.fromY * k,
            toX: g.depth.toX * k,
            toY: g.depth.toY * k,
          },
        }
      : {}),
    ticks: { ...g.ticks, x: g.ticks.x * k, y: g.ticks.y * k, z: g.ticks.z * k },
    ...(g.tickSizes
      ? {
          tickSizes: {
            x: { length: g.tickSizes.x.length * k, width: g.tickSizes.x.width * k },
            y: { length: g.tickSizes.y.length * k, width: g.tickSizes.y.width * k },
            z: { length: g.tickSizes.z.length * k, width: g.tickSizes.z.width * k },
          },
        }
      : {}),
    fontSize: g.fontSize * k,
  }
}

/** The squares of grid or dot paper: their size and where the first line is. */
export interface PaperGrid {
  size: number
  offX: number
  offY: number
}

/**
 * Axes drawn on grid paper, moved onto its lines: the origin on a crossing, each end on the
 * nearest line (at least one square from the origin). A depth axis moves with the origin.
 */
export function snapAxesToGrid<
  A extends {
    origin: Pt
    left: number
    right: number
    top: number
    bottom: number
    depth: { from: Pt; to: Pt; head: boolean } | null
  },
>(axes: A, grid: PaperGrid): A {
  const g = grid.size
  const sx = (v: number) => grid.offX + Math.round((v - grid.offX) / g) * g
  const sy = (v: number) => grid.offY + Math.round((v - grid.offY) / g) * g
  const ox = sx(axes.origin.x)
  const oy = sy(axes.origin.y)
  const dx = ox - axes.origin.x
  const dy = oy - axes.origin.y
  return {
    ...axes,
    origin: { x: ox, y: oy },
    left: Math.min(sx(axes.left + dx), ox),
    right: Math.max(sx(axes.right + dx), ox + g),
    top: Math.min(sy(axes.top + dy), oy - g),
    bottom: Math.max(sy(axes.bottom + dy), oy),
    depth: axes.depth
      ? {
          ...axes.depth,
          from: { x: axes.depth.from.x + dx, y: axes.depth.from.y + dy },
          to: { x: axes.depth.to.x + dx, y: axes.depth.to.y + dy },
        }
      : null,
  }
}
