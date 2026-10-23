import { PAGE_SIZE } from '../model/types.ts'

/** Pages are stacked vertically in world space, one A4 page after another. */
export const PAGE_GAP = 28

export const PAGE_PITCH = PAGE_SIZE.height + PAGE_GAP

export function pageOrigin(index: number): { x: number; y: number } {
  return { x: 0, y: index * PAGE_PITCH }
}

export function contentHeight(pageCount: number): number {
  return Math.max(0, pageCount * PAGE_PITCH - PAGE_GAP)
}

/** The page under a world point, or -1 when the point is in a gap or beside the pages. */
export function pageIndexAt(x: number, y: number, pageCount: number): number {
  if (x < 0 || x > PAGE_SIZE.width || y < 0) return -1
  const index = Math.floor(y / PAGE_PITCH)
  if (index >= pageCount) return -1
  return y - index * PAGE_PITCH <= PAGE_SIZE.height ? index : -1
}
