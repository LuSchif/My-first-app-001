import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * A scroll bar that always shows when there is more to see (iPadOS shows its own only while
 * scrolling): a thin track along the right edge of `target`, whose thumb says how much is
 * shown and where. The thumb can be dragged.
 */
export function ScrollBar({ target }: { target: RefObject<HTMLElement | null> }) {
  const [view, setView] = useState({ top: 0, size: 1 })
  const drag = useRef<{ pointerId: number; y: number; scroll: number } | null>(null)

  useEffect(() => {
    const el = target.current
    if (!el) return
    const measure = () => {
      const size = el.clientHeight / Math.max(1, el.scrollHeight)
      const top = el.scrollTop / Math.max(1, el.scrollHeight)
      setView((v) =>
        Math.abs(v.top - top) < 0.001 && Math.abs(v.size - size) < 0.001 ? v : { top, size },
      )
    }
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // The content grows and shrinks (items added, groups opened).
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    for (const child of el.children) resize.observe(child)
    const mutate = new MutationObserver(() => {
      for (const child of el.children) resize.observe(child)
      measure()
    })
    mutate.observe(el, { childList: true })
    return () => {
      el.removeEventListener('scroll', measure)
      resize.disconnect()
      mutate.disconnect()
    }
  }, [target])

  if (view.size >= 0.999) return null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-2 right-1 bottom-2 w-1.5 rounded-full bg-line/70"
    >
      <div
        className="pointer-events-auto absolute right-0 left-0 touch-none rounded-full bg-ink-subtle before:absolute before:-inset-x-3 before:inset-y-0 before:content-['']"
        style={{
          top: `${view.top * 100}%`,
          height: `${Math.max(view.size * 100, 8)}%`,
        }}
        onPointerDown={(e) => {
          const el = target.current
          if (!el) return
          e.preventDefault()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          drag.current = { pointerId: e.pointerId, y: e.clientY, scroll: el.scrollTop }
        }}
        onPointerMove={(e) => {
          const el = target.current
          const d = drag.current
          if (!el || !d || d.pointerId !== e.pointerId) return
          const track = e.currentTarget.parentElement!.clientHeight
          el.scrollTo({ top: d.scroll + ((e.clientY - d.y) / track) * el.scrollHeight })
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
    </div>
  )
}
