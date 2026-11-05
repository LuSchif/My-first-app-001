import { useEffect, useLayoutEffect, useRef } from 'react'
import type { GestureStroke } from '../../../engine/addons/types.ts'
import { traceStroke } from '../../../engine/geometry/strokePath.ts'

export const PAD_WIDTH = 320
export const PAD_HEIGHT = 180

/**
 * A small sheet to draw on, for an addon's drawn command: records strokes (in the sheet's own
 * points) with the pen, the finger or a mouse. `ghost` strokes show faintly underneath, e.g. the
 * "before" drawing while drawing the "after".
 */
export function DrawPad({
  strokes,
  onChange,
  pen,
  ghost = [],
  label,
}: {
  strokes: GestureStroke[]
  onChange: (strokes: GestureStroke[]) => void
  /** What a new stroke is drawn with. */
  pen: Omit<GestureStroke, 'points'>
  ghost?: GestureStroke[]
  label: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef<GestureStroke | null>(null)
  const latest = useRef({ strokes, onChange, pen, ghost })
  useLayoutEffect(() => {
    latest.current = { strokes, onChange, pen, ghost }
  })

  const paint = () => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    if (c.width !== PAD_WIDTH * dpr) {
      c.width = PAD_WIDTH * dpr
      c.height = PAD_HEIGHT * dpr
    }
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, PAD_WIDTH, PAD_HEIGHT)
    const { strokes: list, ghost: under } = latest.current
    for (const s of under) drawStroke(ctx, s, 0.22)
    for (const s of list) drawStroke(ctx, s, 1)
    if (live.current) drawStroke(ctx, live.current, 1)
  }

  useEffect(paint)

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [
      ((e.clientX - r.left) / r.width) * PAD_WIDTH,
      ((e.clientY - r.top) / r.height) * PAD_HEIGHT,
    ] as const
  }

  return (
    <canvas
      ref={canvas}
      aria-label={label}
      className="aspect-[16/9] w-full touch-none rounded-card bg-[#fffdf9] ring-1 ring-line"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const [x, y] = pos(e)
        live.current = { ...latest.current.pen, points: [x, y] }
        paint()
      }}
      onPointerMove={(e) => {
        if (!live.current) return
        const events = e.nativeEvent.getCoalescedEvents?.() ?? []
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const r = canvas.current!.getBoundingClientRect()
          live.current.points.push(
            ((ev.clientX - r.left) / r.width) * PAD_WIDTH,
            ((ev.clientY - r.top) / r.height) * PAD_HEIGHT,
          )
        }
        paint()
      }}
      onPointerUp={() => {
        const s = live.current
        live.current = null
        if (s && s.points.length >= 4) latest.current.onChange([...latest.current.strokes, s])
        else paint()
      }}
      onPointerCancel={() => {
        live.current = null
        paint()
      }}
    />
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, s: GestureStroke, alpha: number): void {
  const path = new Path2D()
  traceStroke(path, s.points)
  ctx.save()
  ctx.lineCap = s.tool === 'highlighter' ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = s.width
  ctx.strokeStyle = s.color
  ctx.globalAlpha = alpha * (s.tool === 'highlighter' ? 0.45 : 1)
  if (s.tool === 'highlighter') ctx.globalCompositeOperation = 'darken'
  ctx.stroke(path)
  ctx.restore()
}
