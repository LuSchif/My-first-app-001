import { useEffect, useRef } from 'react'
import type { Notebook } from '../../engine/model/types.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { drawPage, preloadPictures } from '../../engine/render/pageImage.ts'
import { cn } from '../../lib/cn.ts'
import { db } from '../../storage/db.ts'

/** The first page of a notebook, small. Loaded and drawn when shown. */
export function NotebookThumbnail({
  notebook,
  width,
  className,
}: {
  notebook: Notebook
  /** Drawing width in CSS pixels. */
  width: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    const pageId = notebook.pageIds[0]
    if (!pageId) return
    void db.pages.get(pageId).then(async (page) => {
      const canvas = ref.current
      if (!alive || !page || !canvas) return
      const dpr = window.devicePixelRatio || 1
      const size = pageSizeOf(notebook)
      const scale = (width * dpr) / size.width
      canvas.width = Math.round(size.width * scale)
      canvas.height = Math.round(size.height * scale)
      const draw = () =>
        drawPage(canvas.getContext('2d')!, page, notebook.layers, scale, notebook.background, size)
      draw()
      await preloadPictures([page])
      if (alive) draw()
    })
    return () => {
      alive = false
    }
  }, [notebook, width])
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        width,
        aspectRatio: `${pageSizeOf(notebook).width} / ${pageSizeOf(notebook).height}`,
      }}
      className={cn('block rounded-sm bg-paper shadow-soft', className)}
    />
  )
}
