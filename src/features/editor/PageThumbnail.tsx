import { useEffect, useRef } from 'react'
import type { LayerDef, Page, PageSize } from '../../engine/model/types.ts'
import { drawPage, preloadPictures } from '../../engine/render/pageImage.ts'

/** A small picture of a page, redrawn when the page changes. */
export function PageThumbnail({
  width,
  page,
  layers,
  background,
  size,
}: {
  /** Drawing width in CSS pixels. */
  width: number
  page: Page
  layers: readonly LayerDef[]
  background: string | undefined
  size: PageSize
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const scale = (width * dpr) / size.width
    canvas.width = Math.round(size.width * scale)
    canvas.height = Math.round(size.height * scale)
    const draw = () => drawPage(canvas.getContext('2d')!, page, layers, scale, background, size)
    draw()
    let alive = true
    void preloadPictures([page]).then(() => alive && draw())
    return () => {
      alive = false
    }
  }, [width, page, layers, background, size])
  return (
    <canvas
      ref={ref}
      className="block w-full bg-paper"
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      aria-hidden="true"
    />
  )
}
