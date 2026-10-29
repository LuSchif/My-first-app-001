import { ChevronLeft, ChevronRight, FolderKanban } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { ScrollBar } from './ScrollBar.tsx'

/** Tile sizes, in px: a tile is 6:5, with its name and details under it (`TILE_TEXT`). */
const TILE_TEXT_PX = 72 + 10
const ROW_GAP = 20
const COLUMN_GAP = 20
const MIN_COLUMNS = 3
const TILE_MIN = 112
const TILE_MAX = 240
/** Kept free below the second row, so it never touches the page's edge. */
const SLACK = 6

export interface CarouselPage {
  key: string
  title: string
  /** Sort and filter menus, beside the title. */
  actions?: ReactNode
  /** Makes the page a place to drop notebooks and folders out of their folder. */
  drop?: 'root'
  /** A group's own page: marked as one in the row of names. */
  group?: boolean
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
  const names = useRef<HTMLDivElement>(null)
  /** The page an arrow or name slides to; pages passed on the way do not count. */
  const aim = useRef<number | null>(null)
  const current = Math.max(0, Math.min(pages.length - 1, index))
  const first = useRef(current)

  // Tiles get one size on every page: as big as fits two full rows of them in a page.
  useEffect(() => {
    const el = track.current
    const body = el?.querySelector<HTMLElement>('[data-carousel-body]')
    if (!el || !body) return
    const fit = () => {
      const style = getComputedStyle(body)
      const h = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      const w = body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const tile = Math.floor(
        Math.max(
          TILE_MIN,
          Math.min(
            TILE_MAX,
            (((h - ROW_GAP - SLACK) / 2 - TILE_TEXT_PX) * 6) / 5,
            (w - (MIN_COLUMNS - 1) * COLUMN_GAP) / MIN_COLUMNS,
          ),
        ),
      )
      el.style.setProperty('--tile-w', `${tile}px`)
      el.style.setProperty('--tile-max', `${tile}px`)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    return () => observer.disconnect()
  }, [])

  // The page chosen last time is shown again, without sliding there.
  useEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = first.current * el.clientWidth
  }, [])

  // Pages added or removed before the one shown (a group's own page) keep it in view.
  const keys = pages.map((p) => p.key).join('|')
  const shownKey = pages[current]?.key
  const knownKeys = useRef(keys)
  useEffect(() => {
    const el = track.current
    // Only when the pages change, not on every swipe.
    if (!el || knownKeys.current === keys) return
    knownKeys.current = keys
    if (aim.current === null) el.scrollLeft = current * el.clientWidth
  }, [keys, current])
  // The name of the page shown stays visible in the row of names.
  useEffect(() => {
    names.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [shownKey])

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
              <PageBody>{page.content}</PageBody>
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
        <div
          ref={names}
          className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((page, i) => (
            <button
              key={page.key}
              type="button"
              aria-current={i === current}
              onClick={() => go(i)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink-muted hover:bg-hover aria-current:bg-ink aria-current:text-ink-inverse"
            >
              {page.group ? <FolderKanban size={14} aria-label="Group" /> : null}
              {page.title}
            </button>
          ))}
        </div>
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

/** A page's content, scrolling up and down, with a scroll bar that shows when there is more. */
function PageBody({ children }: { children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={body}
        data-carousel-body=""
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <ScrollBar target={body} />
    </div>
  )
}
