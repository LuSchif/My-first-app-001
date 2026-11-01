import { useEffect, useRef, useState } from 'react'

/** Moving this far starts a drag (sideways), or lets the panel scroll (up or down). */
const DRAG_PX = 10
/** Holding still this long first starts a drag in any direction. */
const HOLD_MS = 280

export interface DragGhost {
  x: number
  y: number
  label: string
}

interface Press {
  id: number
  x: number
  y: number
  /** 'press' until it is a tap, a drag or a scroll. */
  mode: 'press' | 'drag' | 'scroll'
  held: boolean
  label: string
  onTap: () => void
  onDrop: (clientX: number, clientY: number) => void
}

/**
 * Items in the insert panel go onto the page by a tap (to the middle of the view) or by
 * dragging them there. Sideways, or after holding the item a moment, starts a drag; up and down
 * scrolls the panel. Returns the handlers for an item and the floating copy that follows the
 * finger or pen while dragging.
 */
export function useDragToPage() {
  const press = useRef<Press | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ghost, setGhost] = useState<DragGhost | null>(null)

  // Followed on the window, so the drag goes on wherever the pointer is; while dragging, the
  // touch is kept from scrolling the panel (iPadOS would otherwise take it over).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || p.id !== e.pointerId) return
      if (p.mode === 'press') {
        const dx = Math.abs(e.clientX - p.x)
        const dy = Math.abs(e.clientY - p.y)
        if (dx < DRAG_PX && dy < DRAG_PX) return
        if (dy > dx && !p.held) {
          p.mode = 'scroll'
          return
        }
        p.mode = 'drag'
      }
      if (p.mode === 'drag') setGhost({ x: e.clientX, y: e.clientY, label: p.label })
    }
    const up = (e: PointerEvent) => {
      const p = press.current
      if (!p || p.id !== e.pointerId) return
      press.current = null
      if (timer.current) clearTimeout(timer.current)
      setGhost(null)
      if (e.type === 'pointercancel') return
      if (p.mode === 'drag') p.onDrop(e.clientX, e.clientY)
      else if (p.mode === 'press') p.onTap()
    }
    const touchMove = (e: TouchEvent) => {
      const p = press.current
      if (p && (p.mode === 'drag' || p.held)) e.preventDefault()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('touchmove', touchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('touchmove', touchMove)
    }
  }, [])

  const source = (
    label: string,
    onTap: () => void,
    onDrop: (clientX: number, clientY: number) => void,
  ) => ({
    // Up and down still scroll the panel; sideways belongs to the drag.
    style: { touchAction: 'pan-y' } as const,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // Lets the pointer leave the item without the browser taking it back.
      ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
      const p: Press = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        mode: 'press',
        held: false,
        label,
        onTap,
        onDrop,
      }
      press.current = p
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (press.current !== p || p.mode !== 'press') return
        p.held = true
        setGhost({ x: p.x, y: p.y, label })
      }, HOLD_MS)
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onTap()
      }
    },
    // A context menu (long press on iPad, right click) would cut the drag short.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  return { source, ghost }
}
