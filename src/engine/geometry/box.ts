import type { BoxFrame, BoxObject, CanvasObject } from '../model/types.ts'
import type { Rect } from './rect.ts'

/** Pictures, tables, charts and graphs share this geometry: a rectangle turned around its center. */

export function isBox(object: CanvasObject): object is BoxObject {
  return (
    object.type === 'image' ||
    object.type === 'table' ||
    object.type === 'chart' ||
    object.type === 'graph'
  )
}

export function boxCenter(box: BoxFrame): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export function boxCorners(box: BoxFrame): { x: number; y: number }[] {
  const c = boxCenter(box)
  const cos = Math.cos(box.rotation)
  const sin = Math.sin(box.rotation)
  const hw = box.width / 2
  const hh = box.height / 2
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => ({ x: c.x + dx! * cos - dy! * sin, y: c.y + dx! * sin + dy! * cos }))
}

export function boxBounds(box: BoxFrame, pad = 0): Rect {
  const corners = boxCorners(box)
  return {
    minX: Math.min(...corners.map((p) => p.x)) - pad,
    minY: Math.min(...corners.map((p) => p.y)) - pad,
    maxX: Math.max(...corners.map((p) => p.x)) + pad,
    maxY: Math.max(...corners.map((p) => p.y)) + pad,
  }
}

/** The point in the box's own unrotated frame, measured from its top-left corner. */
export function toBoxLocal(box: BoxFrame, x: number, y: number): { x: number; y: number } {
  const c = boxCenter(box)
  const cos = Math.cos(-box.rotation)
  const sin = Math.sin(-box.rotation)
  const dx = x - c.x
  const dy = y - c.y
  return {
    x: dx * cos - dy * sin + box.width / 2,
    y: dx * sin + dy * cos + box.height / 2,
  }
}

export function boxContains(box: BoxFrame, x: number, y: number, slop = 0): boolean {
  const p = toBoxLocal(box, x, y)
  return p.x >= -slop && p.x <= box.width + slop && p.y >= -slop && p.y <= box.height + slop
}

/** Moves the canvas into the box's frame: (0, 0) is its top-left corner. */
export function enterBox(ctx: CanvasRenderingContext2D, box: BoxFrame): void {
  const c = boxCenter(box)
  ctx.translate(c.x, c.y)
  ctx.rotate(box.rotation)
  ctx.translate(-box.width / 2, -box.height / 2)
}
