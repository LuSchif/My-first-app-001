import { GripHorizontal, GripVertical } from 'lucide-react'
import {
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { PopoverSideContext } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { useVisualViewportBottom } from '../../lib/useVisualViewport.ts'
import {
  layoutVersion,
  report,
  stackOffset,
  subscribe,
  topCorners,
  unregister,
  VerticalContext,
  type Dock,
} from './panelLayout.ts'

export type { Dock }

/**
 * Bars the user can arrange: drag one by its grip anywhere on the screen, or let it snap to the
 * middle of an edge (top, bottom, left, right). At the left and right edges a bar stands
 * upright. Where each bar sits is remembered on this device.
 */

type Placement = { dock: Dock } | { x: number; y: number; vertical: boolean }

/** Distance from the screen's edges. */
const EDGE = 12
/** Space between bars docked at the same edge. */
const GAP = 8
/** How close to an edge a dragged bar snaps to it. */
const SNAP_PX = 96
/** The top corners hold the notebook title and the layer and page buttons. */
const CORNER_ROW = 76

/** A thin line between groups of buttons, across the bar. */
export function PanelDivider() {
  const vertical = useContext(VerticalContext)
  return <span className={cn('shrink-0 bg-line', vertical ? 'my-1 h-px w-7' : 'mx-1 h-7 w-px')} />
}

// ---------- Remembered placement ----------

function load(id: string, fallback: Dock): Placement {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`broomit.panel.${id}`) ?? 'null')
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      if (v.dock === 'top' || v.dock === 'bottom' || v.dock === 'left' || v.dock === 'right') {
        return { dock: v.dock }
      }
      if (typeof v.x === 'number' && typeof v.y === 'number') {
        return { x: v.x, y: v.y, vertical: v.vertical === true }
      }
    }
  } catch {
    // Not stored or unreadable: the default place.
  }
  return { dock: fallback }
}

function save(id: string, placement: Placement): void {
  try {
    localStorage.setItem(`broomit.panel.${id}`, JSON.stringify(placement))
  } catch {
    // Not remembered; the bar stays where it is until reload.
  }
}

const isVertical = (p: Placement) =>
  'dock' in p ? p.dock === 'left' || p.dock === 'right' : p.vertical

/** The edge a bar dragged to (x, y) snaps to, if any. */
function snapAt(x: number, y: number, bottom: number): Dock | null {
  const w = window.innerWidth
  const candidates: [Dock, number][] = [
    ['top', y],
    ['bottom', bottom - y],
    ['left', x],
    ['right', w - x],
  ]
  const [dock, distance] = candidates.sort((a, b) => a[1] - b[1])[0]!
  return distance < SNAP_PX ? dock : null
}

// ---------- The bar ----------

export function FloatingPanel({
  id,
  label,
  defaultDock,
  order,
  className,
  children,
  ...rest
}: {
  id: string
  label: string
  defaultDock: Dock
  /** Bars at the same edge line up by this number, lowest nearest the edge. */
  order: number
  className?: string
  children: ReactNode
} & Record<`data-${string}`, string>) {
  const [placement, setPlacement] = useState<Placement>(() => load(id, defaultDock))
  const [drag, setDrag] = useState<{ x: number; y: number; snap: Dock | null } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const grab = useRef<{ pointerId: number; dx: number; dy: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const bottom = useVisualViewportBottom()
  useSyncExternalStore(subscribe, layoutVersion)

  const vertical = drag?.snap
    ? drag.snap === 'left' || drag.snap === 'right'
    : isVertical(placement)
  const dock = drag ? null : 'dock' in placement ? placement.dock : null

  // Measure the bar, and tell the others at the same edge.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const next = { width: el.offsetWidth, height: el.offsetHeight }
      setSize((s) => (s.width === next.width && s.height === next.height ? s : next))
      report(id, { dock, order, ...next })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [id, dock, order])
  useLayoutEffect(
    () => () => {
      unregister(id)
    },
    [id],
  )

  const style = position()

  function position(): CSSProperties {
    const vw = window.innerWidth
    const { width, height } = size
    if (drag) return { left: drag.x, top: drag.y }
    if (!('dock' in placement)) {
      // A free bar stays fully on screen, also when the screen turns or the keyboard opens.
      return {
        left: Math.max(EDGE, Math.min(vw - width - EDGE, placement.x)),
        top: Math.max(EDGE, Math.min(bottom - height - EDGE, placement.y)),
      }
    }
    const offset = stackOffset(id, placement.dock)
    const middleY = Math.max(CORNER_ROW, (CORNER_ROW + bottom - height) / 2)
    switch (placement.dock) {
      case 'top': {
        // In the top row, between the corner groups: centered when there is room, else moved
        // along to where it fits; below them only when the row is too narrow.
        const corners = topCorners()
        const from = corners.left + EDGE + GAP
        const to = vw - corners.right - EDGE - GAP
        const fits = to - from >= width
        const left = fits
          ? Math.min(to - width, Math.max(from, (vw - width) / 2))
          : (vw - width) / 2
        return { left, top: (fits ? 10 : CORNER_ROW) + offset }
      }
      case 'bottom':
        return { left: (vw - width) / 2, top: bottom - height - EDGE - offset }
      case 'left':
        return { left: EDGE + offset, top: middleY }
      case 'right':
        return { left: vw - width - EDGE - offset, top: middleY }
    }
  }

  const onGripDown = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const r = el.getBoundingClientRect()
    grab.current = { pointerId: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top }
    setDrag({ x: r.left, y: r.top, snap: null })
  }
  const onGripMove = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== e.pointerId) return
    e.preventDefault()
    setDrag({
      x: e.clientX - g.dx,
      y: e.clientY - g.dy,
      snap: snapAt(e.clientX, e.clientY, bottom),
    })
  }
  const onGripUp = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== e.pointerId) return
    grab.current = null
    const d = drag
    setDrag(null)
    if (!d) return
    const next: Placement = d.snap
      ? { dock: d.snap }
      : { x: d.x, y: d.y, vertical: isVertical(placement) }
    setPlacement(next)
    save(id, next)
  }

  // Menus open away from the edge the bar sits at.
  const popoverSide =
    dock === 'top'
      ? 'bottom'
      : dock === 'bottom'
        ? 'top'
        : dock === 'left'
          ? 'right'
          : dock === 'right'
            ? 'left'
            : (style.top as number) + size.height / 2 < bottom / 2
              ? 'bottom'
              : 'top'

  const Grip = vertical ? GripHorizontal : GripVertical
  return (
    <>
      {drag ? <SnapTargets active={drag.snap} bottom={bottom} /> : null}
      <div
        ref={ref}
        role="toolbar"
        aria-label={label}
        aria-orientation={vertical ? 'vertical' : 'horizontal'}
        {...rest}
        style={{ ...style, maxHeight: vertical ? bottom - CORNER_ROW - EDGE : undefined }}
        className={cn(
          'pointer-events-auto fixed z-20 flex items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur',
          vertical ? 'flex-col overflow-y-auto' : 'flex-row',
          drag && 'opacity-90 shadow-overlay',
          className,
        )}
      >
        <button
          type="button"
          aria-label={`Move ${label.toLowerCase()}`}
          title="Drag to move; drop at an edge to snap"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          className={cn(
            'grid shrink-0 cursor-grab touch-none place-items-center rounded-control text-ink-subtle hover:bg-hover active:cursor-grabbing',
            vertical ? 'h-6 w-11' : 'h-11 w-6',
          )}
        >
          <Grip size={18} />
        </button>
        <VerticalContext.Provider value={vertical}>
          <PopoverSideContext.Provider value={popoverSide}>{children}</PopoverSideContext.Provider>
        </VerticalContext.Provider>
      </div>
    </>
  )
}

/** While a bar is dragged: the four places it can snap to, the one it would take highlighted. */
function SnapTargets({ active, bottom }: { active: Dock | null; bottom: number }) {
  const marks: [Dock, CSSProperties][] = [
    ['top', { left: '50%', top: EDGE, width: 160, height: 6, transform: 'translateX(-50%)' }],
    [
      'bottom',
      { left: '50%', top: bottom - EDGE - 6, width: 160, height: 6, transform: 'translateX(-50%)' },
    ],
    ['left', { left: EDGE, top: (CORNER_ROW + bottom) / 2 - 80, width: 6, height: 160 }],
    ['right', { right: EDGE, top: (CORNER_ROW + bottom) / 2 - 80, width: 6, height: 160 }],
  ]
  return (
    <>
      {marks.map(([dock, style]) => (
        <span
          key={dock}
          aria-hidden="true"
          style={style}
          className={cn(
            'pointer-events-none fixed z-30 rounded-full transition-colors',
            active === dock ? 'bg-accent' : 'bg-ink/15',
          )}
        />
      ))}
    </>
  )
}
