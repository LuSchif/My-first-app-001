/**
 * The camera maps world coordinates (page space, in points) to screen coordinates (CSS pixels):
 *   screen = world * zoom + offset
 * It is a plain value so it can be stored, compared and animated without side effects.
 */
export interface Camera {
  offsetX: number
  offsetY: number
  zoom: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8

export const IDENTITY_CAMERA: Camera = { offsetX: 0, offsetY: 0, zoom: 1 }

export function worldToScreen(camera: Camera, p: Point): Point {
  return { x: p.x * camera.zoom + camera.offsetX, y: p.y * camera.zoom + camera.offsetY }
}

export function screenToWorld(camera: Camera, p: Point): Point {
  return { x: (p.x - camera.offsetX) / camera.zoom, y: (p.y - camera.offsetY) / camera.zoom }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, offsetX: camera.offsetX + dx, offsetY: camera.offsetY + dy }
}

/** Zooms by `factor` while keeping the world point under `anchor` (screen space) fixed. */
export function zoomAt(camera: Camera, anchor: Point, factor: number): Camera {
  const zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const world = screenToWorld(camera, anchor)
  return { zoom, offsetX: anchor.x - world.x * zoom, offsetY: anchor.y - world.y * zoom }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
