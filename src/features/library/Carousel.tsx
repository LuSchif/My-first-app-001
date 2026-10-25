import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'

export interface CarouselPage {
  key: string
  title: string
  /** Sort and filter menus, beside the title. */
  actions?: ReactNode
  /** Makes the page a place to drop notebooks and folders out of their folder. */
  drop?: 'root'
  content: ReactNode
}

/**
 * Pages side by side: swipe between them, or use the arrows and names below. Each page scrolls
 * up and down on its own.
 */
export function Carousel({
  pages,
  index,
  onIndex,
  overlay,
  className,
}: {
  pages: CarouselPage[]
  index: number
  onIndex: (index: number) => void
  /** Shown over the pages, at the bottom (e.g. folders to drop into). */
  overlay?: ReactNode
  className?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  /** The page an arrow or name slides to; pages passed on the way do not count. */
  const aim = useRef<number | null>(null)
  const current = Math.max(0, Math.min(pages.length - 1, index))
  const first = useRef(current)

  // The page chosen last time is shown again, without sliding there.
  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = first.current * el.clientWidth
  }, [])

  const go = (next: number) => {
    const el = track.current
    const target = Math.max(0, Math.min(pages.length - 1, next))
    if (!el || target === current) return
    aim.current = target
    // In case the slide stops short of it (or is interrupted by a finger).
    setTimeout(() => {
      if (aim.current === target) aim.current = null
    }, 900)
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' })
    onIndex(target)
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget
            const at = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
            if (aim.current !== null) {
              // Sliding to a chosen page: done once it is there.
              if (Math.abs(el.scrollLeft - aim.current * el.clientWidth) < 2) aim.current = null
              return
            }
            if (at !== current) onIndex(at)
          }}
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-panel bg-surface-raised shadow-soft ring-1 ring-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page, i) => (
            <section
              key={page.key}
              aria-label={page.title}
              aria-hidden={i !== current}
              {...(page.drop ? { 'data-drop': page.drop } : {})}
              className="flex w-full shrink-0 snap-start snap-always flex-col"
            >
              <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
                <h2 className="text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
                  {page.title}
                </h2>
                {page.actions ? <div className="flex flex-wrap gap-1">{page.actions}</div> : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {page.content}
              </div>
            </section>
          ))}
        </div>
        {overlay}
      </div>
      <nav aria-label="Show" className="flex items-center justify-center gap-1">
        <IconButton
          label="Previous"
          icon={<ChevronLeft size={20} />}
          disabled={current === 0}
          onClick={() => go(current - 1)}
        />
        {pages.map((page, i) => (
          <button
            key={page.key}
            type="button"
            aria-current={i === current}
            onClick={() => go(i)}
            className="h-9 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-hover aria-current:bg-ink aria-current:text-ink-inverse"
          >
            {page.title}
          </button>
        ))}
        <IconButton
          label="Next"
          icon={<ChevronRight size={20} />}
          disabled={current === pages.length - 1}
          onClick={() => go(current + 1)}
        />
      </nav>
    </div>
  )
}
