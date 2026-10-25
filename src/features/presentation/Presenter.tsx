import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import { SlideShow, type ShowPosition } from '../../engine/present/SlideShow.ts'
import { onImageLoaded } from '../../engine/render/images.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { preloadPictures } from '../../engine/render/pageImage.ts'

/** A swipe this long (CSS pixels) moves on or back; shorter touches are taps. */
const SWIPE = 60

const control =
  'grid size-11 place-items-center rounded-full text-white/85 hover:bg-white/15 active:bg-white/25 disabled:opacity-30'

/**
 * The slide show: the presentation full screen, without notes or tools. A tap (or the right
 * arrow, space) plays the next animation or slide; the left third of the screen, a swipe to
 * the right or the left arrow goes back. Escape ends it.
 */
export function Presenter({
  doc,
  start,
  onExit,
}: {
  doc: NotebookDocument
  start: number
  /** With the slide that was shown last. */
  onExit: (slide: number) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const show = useRef<SlideShow | null>(null)
  const redraw = useRef<() => void>(() => {})
  const [position, setPosition] = useState<ShowPosition>({ slide: start, step: 0, ended: false })
  const count = doc.pageList.length
  const exit = useRef(onExit)
  useEffect(() => {
    exit.current = onExit
  })

  useEffect(() => {
    const el = canvas.current!
    const ctx = el.getContext('2d')!
    const backdrop =
      getComputedStyle(document.documentElement).getPropertyValue('--color-stage').trim() || 'black'
    const pages = doc.pageList
    const instance = new SlideShow(
      pages,
      doc.notebook.layers,
      doc.notebook.background,
      pageSizeOf(doc.notebook),
      start,
      performance.now(),
    )
    show.current = instance

    let frame = 0
    const paint = () => {
      frame = 0
      const now = performance.now()
      instance.draw(ctx, now, backdrop)
      if (instance.busy(now)) frame = requestAnimationFrame(paint)
    }
    const request = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    redraw.current = request

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      el.width = Math.round(el.clientWidth * dpr)
      el.height = Math.round(el.clientHeight * dpr)
      request()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    const stopImages = onImageLoaded(request)
    void preloadPictures(pages).then(request)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      stopImages()
      show.current = null
    }
  }, [doc, start])

  const step = (direction: 1 | -1) => {
    const instance = show.current
    if (!instance) return
    if (direction === 1) {
      if (instance.position.ended) {
        exit.current(instance.position.slide)
        return
      }
      instance.next(performance.now())
    } else instance.back()
    setPosition(instance.position)
    redraw.current()
  }
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })

  // Keys, and the whole screen while presenting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        stepRef.current(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        stepRef.current(-1)
      } else if (e.key === 'Escape') {
        exit.current(show.current?.position.slide ?? 0)
      }
    }
    window.addEventListener('keydown', onKey)
    const el = root.current
    // Not every browser can (the iPad's Safari only for videos); then the overlay fills the app.
    if (el?.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  const down = useRef<{ x: number; y: number; id: number } | null>(null)

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Presenting"
      className="fixed inset-0 z-50 touch-none bg-stage select-none"
      onPointerDown={(e) => {
        if (!down.current) down.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
      }}
      onPointerUp={(e) => {
        const start = down.current
        if (!start || start.id !== e.pointerId) return
        down.current = null
        const dx = e.clientX - start.x
        const dy = e.clientY - start.y
        if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
          step(dx < 0 ? 1 : -1)
          return
        }
        if (Math.hypot(dx, dy) > 12) return
        const width = root.current?.clientWidth ?? window.innerWidth
        step(e.clientX < width / 3 ? -1 : 1)
      }}
      onPointerCancel={() => {
        down.current = null
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      {position.ended ? (
        <div className="pointer-events-none absolute inset-0 grid place-content-center gap-2 text-center text-white/80">
          <p className="text-lg font-semibold">End of presentation</p>
          <p className="text-sm text-white/60">Tap to exit</p>
        </div>
      ) : null}
      <div
        className="absolute right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] flex items-center gap-1 rounded-full bg-stage/60 p-1 text-white backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Back"
          className={control}
          disabled={position.slide === 0 && position.step === 0 && !position.ended}
          onClick={() => step(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-14 text-center text-sm font-semibold tabular-nums">
          {position.slide + 1} / {count}
        </span>
        <button type="button" aria-label="Next" className={control} onClick={() => step(1)}>
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          aria-label="End presentation"
          className={control}
          onClick={() => exit.current(position.slide)}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  )
}
