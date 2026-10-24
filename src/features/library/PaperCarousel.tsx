import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PaperKind } from '../../engine/model/types.ts'
import { IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { PAPER_OPTIONS } from '../paper.ts'
import { PaperPreview } from './PaperPreview.tsx'

const SHEET_WIDTH = 116

/**
 * The papers side by side, each as a real preview. Swipe or scroll: the sheet that comes to rest
 * in the middle is chosen. A tap, the arrow buttons and the arrow keys work too.
 */
export function PaperCarousel({
  value,
  onChange,
}: {
  value: PaperKind
  onChange: (kind: PaperKind) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const index = Math.max(
    0,
    PAPER_OPTIONS.findIndex((o) => o.kind === value),
  )
  // Set while the track scrolls to a sheet chosen by tap, arrow or key, so the scroll that
  // follows does not choose the sheets it passes.
  const steering = useRef(false)

  const centerOn = (i: number, smooth: boolean) => {
    const el = track.current?.children[i] as HTMLElement | undefined
    const t = track.current
    if (!el || !t) return
    steering.current = smooth
    t.scrollTo({
      left: el.offsetLeft + el.offsetWidth / 2 - t.clientWidth / 2,
      behavior: smooth ? 'smooth' : 'auto',
    })
  }

  const choose = (i: number) => {
    const option = PAPER_OPTIONS[Math.max(0, Math.min(PAPER_OPTIONS.length - 1, i))]!
    onChange(option.kind)
    centerOn(PAPER_OPTIONS.indexOf(option), true)
  }

  // The chosen sheet starts in the middle (only when the carousel appears).
  const startIndex = useRef(index)
  useLayoutEffect(() => {
    const t = track.current
    const el = t?.children[startIndex.current] as HTMLElement | undefined
    if (t && el) t.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - t.clientWidth / 2
  }, [])

  // When scrolling by hand comes to rest, the sheet in the middle is chosen.
  useEffect(() => {
    const t = track.current
    if (!t) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = () => {
      if (steering.current) {
        steering.current = false
        return
      }
      const middle = t.scrollLeft + t.clientWidth / 2
      let best = 0
      let bestDistance = Infinity
      Array.from(t.children).forEach((child, i) => {
        const el = child as HTMLElement
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - middle)
        if (d < bestDistance) {
          best = i
          bestDistance = d
        }
      })
      const kind = PAPER_OPTIONS[best]!.kind
      if (kind !== value) onChange(kind)
    }
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(settle, 140)
    }
    t.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      t.removeEventListener('scroll', onScroll)
    }
  }, [value, onChange])

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous paper"
        icon={<ChevronLeft size={22} />}
        disabled={index === 0}
        onClick={() => choose(index - 1)}
        className="shrink-0"
      />
      <div
        ref={track}
        role="listbox"
        aria-label="Paper"
        aria-activedescendant={`paper-${value}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            choose(index + (e.key === 'ArrowRight' ? 1 : -1))
          }
        }}
        className="relative flex min-w-0 flex-1 snap-x snap-mandatory gap-5 overflow-x-auto rounded-card py-4 [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-scrollbar]:hidden"
        style={{ paddingInline: `calc(50% - ${SHEET_WIDTH / 2}px)` }}
      >
        {PAPER_OPTIONS.map((option, i) => {
          const selected = option.kind === value
          return (
            <button
              key={option.kind}
              id={`paper-${option.kind}`}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              onClick={() => choose(i)}
              className="grid shrink-0 snap-center justify-items-center gap-2 text-sm"
            >
              <span
                className={cn(
                  'overflow-hidden rounded-md shadow-raised ring-offset-2 ring-offset-surface-raised transition-transform duration-300 ease-gentle',
                  selected ? 'scale-105 ring-2 ring-ink' : 'scale-95 opacity-75 ring-1 ring-line',
                )}
              >
                {/* A close-up of the page's top left, so the pattern reads at this size. */}
                <PaperPreview kind={option.kind} width={SHEET_WIDTH} detail={0.5} />
              </span>
              <span className={cn(selected ? 'font-semibold text-ink' : 'text-ink-muted')}>
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
      <IconButton
        label="Next paper"
        icon={<ChevronRight size={22} />}
        disabled={index === PAPER_OPTIONS.length - 1}
        onClick={() => choose(index + 1)}
        className="shrink-0"
      />
    </div>
  )
}
