import * as RadixPopover from '@radix-ui/react-popover'
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn.ts'
import { keyboardInset, onKeyboardInset } from '../../lib/keyboardInset.ts'
import { CloseContext, PopoverSideContext, useClosePopover } from './popoverContext.ts'

export const PopoverTrigger = RadixPopover.Trigger
export const PopoverClose = RadixPopover.Close

/** A popover that can be closed from inside (`useClosePopover`); controlled or not. */
export function Popover({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const [own, setOwn] = useState(false)
  const isOpen = open ?? own
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setOwn(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )
  const close = useCallback(() => setOpen(false), [setOpen])
  return (
    <CloseContext.Provider value={close}>
      <RadixPopover.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </RadixPopover.Root>
    </CloseContext.Provider>
  )
}

/** Floating panel for tool settings and small menus. */
export function PopoverContent({
  children,
  className,
  side,
  align = 'center',
  movable,
}: {
  children: ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /**
   * Gives the popover a grip to drag it elsewhere; the name remembers where it was put, so it
   * opens there again (moved by the same distance from its button).
   */
  movable?: string
}) {
  const close = useClosePopover()
  const defaultSide = useContext(PopoverSideContext)
  const ref = useRef<HTMLDivElement>(null)
  // The app's own keyboard counts as the screen's edge: a popover opens above it, never under it.
  const keyboard = useSyncExternalStore(onKeyboardInset, keyboardInset)
  const [offset, setOffset] = useState(() => loadOffset(movable))
  const grab = useRef<{
    pointerId: number
    x: number
    y: number
    from: Offset
    rect: DOMRect
  } | null>(null)

  // A remembered place that would now be off screen (another button, a turned screen) is
  // pulled back into view.
  useLayoutEffect(() => {
    const el = ref.current
    if (!movable || !el) return
    const r = el.getBoundingClientRect()
    const dx = clampShift(r.left, r.right, window.innerWidth)
    const dy = clampShift(r.top, r.bottom, window.innerHeight - keyboard)
    if (dx || dy) setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
  }, [movable, keyboard])

  const onGripDown = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const rect = el.getBoundingClientRect()
    grab.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, from: offset, rect }
  }
  const onGripMove = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== e.pointerId) return
    // The whole popover stays on screen and above the keyboard.
    let dx = e.clientX - g.x
    let dy = e.clientY - g.y
    dx += clampShift(g.rect.left + dx, g.rect.right + dx, window.innerWidth)
    dy += clampShift(g.rect.top + dy, g.rect.bottom + dy, window.innerHeight - keyboard)
    setOffset({ x: g.from.x + dx, y: g.from.y + dy })
  }
  const onGripUp = (e: React.PointerEvent) => {
    const g = grab.current
    if (!g || g.pointerId !== e.pointerId) return
    grab.current = null
    saveOffset(movable, offset)
  }

  // Radix waits for a click before closing on an outside touch, and the canvas cancels touches
  // so no click ever comes. Close on the touch itself instead.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      const content = ref.current
      if (!target || !content) return
      if (content.contains(target)) return
      // A popover opened from this one (e.g. a font list) is portalled after it; touching it
      // keeps this one open.
      const other = target.closest('[data-radix-popper-content-wrapper]')
      const own = content.closest('[data-radix-popper-content-wrapper]')
      if (other && own && own.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return
      }
      if (content.id && target.closest(`[aria-controls="${content.id}"]`)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [close])

  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        side={side ?? defaultSide}
        align={align}
        sideOffset={10}
        collisionPadding={{ top: 16, right: 16, left: 16, bottom: 16 + keyboard }}
        // Focus going back to the trigger would pop up its tooltip after every choice, and focus
        // moving into the menu could land on a text field and bring up the keyboard.
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'z-60 max-h-[var(--radix-popover-content-available-height)] w-72 animate-pop-in overflow-y-auto rounded-panel bg-surface-raised p-4 shadow-raised ring-1 ring-line',
          className,
        )}
        style={movable ? { translate: `${offset.x}px ${offset.y}px` } : undefined}
      >
        {movable ? (
          <div
            role="presentation"
            title="Drag to move"
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            className="-mx-2 -mt-2 mb-1 flex h-6 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
        ) : null}
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  )
}

interface Offset {
  x: number
  y: number
}

/** How far to move a span start..end so it lies within 0..limit, with a small margin. */
function clampShift(start: number, end: number, limit: number): number {
  const margin = 8
  if (start < margin) return margin - start
  if (end > limit - margin) return Math.max(margin - start, limit - margin - end)
  return 0
}

function loadOffset(name: string | undefined): Offset {
  if (!name) return { x: 0, y: 0 }
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`broomit.popover.${name}`) ?? 'null')
    const v = value as Partial<Offset> | null
    if (v && typeof v.x === 'number' && typeof v.y === 'number') return { x: v.x, y: v.y }
  } catch {
    // Not stored: the popover opens at its button.
  }
  return { x: 0, y: 0 }
}

function saveOffset(name: string | undefined, offset: Offset): void {
  if (!name) return
  try {
    localStorage.setItem(`broomit.popover.${name}`, JSON.stringify(offset))
  } catch {
    // Not remembered; it opens at its button next time.
  }
}
