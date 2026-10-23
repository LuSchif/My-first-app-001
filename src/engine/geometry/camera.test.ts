import { describe, expect, it } from 'vitest'
import {
  IDENTITY_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Camera,
} from './camera.ts'

describe('camera', () => {
  const camera: Camera = { offsetX: 40, offsetY: -20, zoom: 2 }

  it('round-trips between world and screen space', () => {
    const world = { x: 123.5, y: -7 }
    const back = screenToWorld(camera, worldToScreen(camera, world))
    expect(back.x).toBeCloseTo(world.x)
    expect(back.y).toBeCloseTo(world.y)
  })

  it('pans in screen pixels', () => {
    expect(panBy(IDENTITY_CAMERA, 10, -5)).toEqual({ offsetX: 10, offsetY: -5, zoom: 1 })
  })

  it('keeps the anchor point fixed while zooming', () => {
    const anchor = { x: 300, y: 200 }
    const before = screenToWorld(camera, anchor)
    const after = screenToWorld(zoomAt(camera, anchor, 1.5), anchor)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('clamps the zoom level', () => {
    expect(zoomAt(camera, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(camera, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM)
  })
})
