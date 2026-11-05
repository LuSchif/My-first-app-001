import { useEffect, useLayoutEffect, useRef } from 'react'
import type { GestureStroke } from '../../../engine/addons/types.ts'
import { traceStroke } from '../../../engine/geometry/strokePath.ts'
import { showNotice } from '../../../lib/notices.ts'

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
  fillable = false,
}: {
  strokes: GestureStroke[]
  onChange: (strokes: GestureStroke[]) => void
  /** What a new stroke is drawn with. */
  pen: Omit<GestureStroke, 'points'>
  ghost?: GestureStroke[]
  label: string
  /** Colors dragged onto a closed stroke fill it. */
  fillable?: boolean
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

  // A color dropped onto the sheet fills the closed stroke under it.
  useEffect(() => {
    const c = canvas.current
    if (!c || !fillable) return
    const onFill = (e: Event) => {
      const { clientX, clientY, color } = (
        e as CustomEvent<{
          clientX: number
          clientY: number
          color: string
        }>
      ).detail
      const r = c.getBoundingClientRect()
      const x = ((clientX - r.left) / r.width) * PAD_WIDTH
      const y = ((clientY - r.top) / r.height) * PAD_HEIGHT
      const { strokes: list, onChange: change } = latest.current
      // The smallest closed stroke around the point, so a shape inside another can be filled.
      let best = -1
      let area = Infinity
      list.forEach((s, i) => {
        if (!isClosed(s.points) || !inside(s.points, x, y)) return
        const a = polygonArea(s.points)
        if (a < area) {
          area = a
          best = i
        }
      })
      if (best < 0) {
        showNotice('Drop the color inside a closed shape.')
        return
      }
      change(list.map((s, i) => (i === best ? { ...s, fill: color } : s)))
    }
    c.addEventListener('broomit:fill', onFill)
    return () => c.removeEventListener('broomit:fill', onFill)
  }, [fillable])

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
      data-fill-target={fillable ? '' : undefined}
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
  if (s.fill) {
    const area = new Path2D()
    traceStroke(area, s.points, { closed: true })
    ctx.globalAlpha = alpha
    ctx.fillStyle = s.fill
    ctx.fill(area)
  }
  ctx.lineCap = s.tool === 'highlighter' ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = s.width
  ctx.strokeStyle = s.color
  ctx.globalAlpha = alpha * (s.tool === 'highlighter' ? 0.45 : 1)
  if (s.tool === 'highlighter') ctx.globalCompositeOperation = 'darken'
  ctx.stroke(path)
  ctx.restore()
}

/** Whether a stroke ends near where it started, enclosing an area. */
function isClosed(points: readonly number[]): boolean {
  const n = points.length / 2
  if (n < 4) return false
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, points[i * 2]!)
    maxX = Math.max(maxX, points[i * 2]!)
    minY = Math.min(minY, points[i * 2 + 1]!)
    maxY = Math.max(maxY, points[i * 2 + 1]!)
  }
  const size = Math.max(maxX - minX, maxY - minY)
  const gap = Math.hypot(points[0]! - points[(n - 1) * 2]!, points[1]! - points[(n - 1) * 2 + 1]!)
  return size > 6 && gap < Math.max(12, size * 0.25)
}

/** Even-odd test of a point against the polygon through the points (closing it). */
function inside(points: readonly number[], x: number, y: number): boolean {
  const n = points.length / 2
  let hit = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i * 2]!
    const yi = points[i * 2 + 1]!
    const xj = points[j * 2]!
    const yj = points[j * 2 + 1]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function polygonArea(points: readonly number[]): number {
  const n = points.length / 2
  let a = 0
  for (let i = 0, j = n - 1; i < n; j = i++) {
    a += points[j * 2]! * points[i * 2 + 1]! - points[i * 2]! * points[j * 2 + 1]!
  }
  return Math.abs(a / 2)
}
