import { useEffect, useRef } from 'react'
import { nibWidthAt } from '../../engine/geometry/nib.ts'
import { smoothedValueAt } from '../../engine/geometry/strokePath.ts'
import type { StrokeDash, StrokeObject } from '../../engine/model/types.ts'
import { paintStroke } from '../../engine/render/strokes.ts'

const WIDTH = 280
const HEIGHT = 44

/** A sample line, drawn by the same code as the page, so the preview shows the real pen. */
export function PenPreview({
  color,
  width,
  opacity,
  dash,
  fountain,
}: {
  color: string
  width: number
  opacity: number
  dash: StrokeDash | null
  fountain: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = WIDTH * dpr
    canvas.height = HEIGHT * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    // A wave with a loop: it shows thick and thin parts, and pressure rising in the middle.
    const points: number[] = []
    const pressures: number[] = []
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      points.push(24 + t * 232, HEIGHT / 2 + Math.sin(t * Math.PI * 3) * 11)
      pressures.push(0.3 + 0.5 * Math.sin(t * Math.PI))
    }
    const raw = pressures.map((_, i) => nibWidthAt(points, pressures, width, i))
    const stroke: StrokeObject = {
      id: 'preview',
      type: 'stroke',
      layerId: 'preview',
      tool: 'pen',
      color,
      width,
      opacity,
      points,
      ...(fountain ? { widths: raw.map((_, i) => smoothedValueAt(raw, i)) } : {}),
      ...(dash && !fountain ? { dash } : {}),
    }
    paintStroke(ctx, stroke)
  }, [color, width, opacity, dash, fountain])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="h-11 w-full rounded-control bg-paper ring-1 ring-line"
      style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
    />
  )
}
