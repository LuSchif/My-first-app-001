import { useEffect, useRef } from 'react'
import type { BoxObject } from '../../engine/model/types.ts'
import { paintObject } from '../../engine/render/objects.ts'

/**
 * A small live picture of a table or chart while it is being edited, drawn by the same code as
 * the page, so what you see here is what lands on the page.
 */
export function ObjectPreview({ object, height = 170 }: { object: BoxObject; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const ctx = canvas.getContext('2d')!
    const pad = 10
    const scale = Math.min(
      (width - pad * 2) / object.width,
      (height - pad * 2) / object.height,
      2.5,
    )
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.translate((width - object.width * scale) / 2, (height - object.height * scale) / 2)
    ctx.scale(scale, scale)
    paintObject(ctx, { ...object, x: 0, y: 0, rotation: 0 })
  }, [object, height])
  return (
    <canvas
      ref={ref}
      aria-label="Preview"
      className="block w-full rounded-control bg-paper ring-1 ring-line"
      style={{ height }}
    />
  )
}
