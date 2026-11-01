import { useRef, useState } from 'react'

/** Moving this far sideways starts a drag; moving up or down scrolls the panel instead. */
const DRAG_PX = 10

export interface DragGhost {
  x: number
  y: number
  label: string
}

/**
 * Items in the insert panel go onto the page by a tap (to the middle of the view) or by
 * dragging them there. Returns the handlers for an item and the floating copy that follows the
 * finger or pen while dragging.
 */
export function useDragToPage() {
  const drag = useRef<{
    id: number
    x: number
    y: number
    moved: boolean
    label: string
    onTap: () => void
    onDrop: (clientX: number, clientY: number) => void
  } | null>(null)
  const [ghost, setGhost] = useState<DragGhost | null>(null)

  const source = (
    label: string,
    onTap: () => void,
    onDrop: (clientX: number, clientY: number) => void,
  ) => ({
    // Up and down still scroll the panel; sideways belongs to the drag.
    style: { touchAction: 'pan-y' } as const,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        label,
        onTap,
        onDrop,
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      if (!d.moved) {
        const dx = Math.abs(e.clientX - d.x)
        const dy = Math.abs(e.clientY - d.y)
        if (dx < DRAG_PX && dy < DRAG_PX) return
        if (dy > dx && e.pointerType === 'touch') {
          drag.current = null
          return
        }
        d.moved = true
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      setGhost({ x: e.clientX, y: e.clientY, label: d.label })
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current
      if (!d || d.id !== e.pointerId) return
      drag.current = null
      setGhost(null)
      if (d.moved) d.onDrop(e.clientX, e.clientY)
      else d.onTap()
    },
    // A key press (no pointer) counts as a tap.
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) onTap()
    },
    onPointerCancel: () => {
      drag.current = null
      setGhost(null)
    },
  })

  return { source, ghost }
}
