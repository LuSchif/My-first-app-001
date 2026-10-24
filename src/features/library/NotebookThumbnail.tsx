import { useEffect, useRef } from 'react'
import { PAGE_SIZE, type Notebook } from '../../engine/model/types.ts'
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
      const scale = (width * dpr) / PAGE_SIZE.width
      canvas.width = Math.round(PAGE_SIZE.width * scale)
      canvas.height = Math.round(PAGE_SIZE.height * scale)
      const draw = () =>
        drawPage(canvas.getContext('2d')!, page, notebook.layers, scale, notebook.background)
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
      style={{ width }}
      className={cn('block aspect-[595/842] rounded-sm bg-paper shadow-soft', className)}
    />
  )
}
