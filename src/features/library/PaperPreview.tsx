import { useEffect, useRef } from 'react'
import { PAGE_SIZE, type PaperKind } from '../../engine/model/types.ts'
import { drawPaper, PAPER_STYLE } from '../../engine/render/paper.ts'
import { cn } from '../../lib/cn.ts'

/** A sheet of paper drawn exactly as the editor draws it, only smaller. */
export function PaperPreview({
  kind,
  width,
  detail = 1,
  className,
}: {
  kind: PaperKind
  /** Width in CSS pixels. */
  width: number
  /** How much of the page's width to show, from its top left: below 1 shows a close-up. */
  detail?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const scale = (width * dpr) / (PAGE_SIZE.width * detail)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round((width * dpr * PAGE_SIZE.height) / PAGE_SIZE.width)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.fillStyle = PAPER_STYLE.paper
    ctx.fillRect(0, 0, PAGE_SIZE.width, PAGE_SIZE.height)
    // Lines a little stronger than on a full page, so they read at this size.
    drawPaper(ctx, kind, scale / dpr / 1.6)
  }, [kind, width, detail])
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ width }}
      className={cn('block aspect-[595/842]', className)}
    />
  )
}
