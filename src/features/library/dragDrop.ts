import { useRef, useSyncExternalStore } from 'react'
import type { Id } from '../../engine/model/types.ts'

/**
 * Drag and drop in the library. Holding a folder or notebook (or dragging it with a mouse)
 * picks it up; it can be dropped onto a folder (into it), beside a folder (to sort folders), or
 * onto a "no folder" area. Drop targets are marked in the DOM:
 *   data-drop="folder" data-drop-id="<id>"   a folder
 *   data-drop="root"                          the top level (no folder)
 *   data-drop="trash"                         the trash, at the bottom while dragging
 *   data-drop-sort, data-drop-axis="y"        sorts beside the folder (above or below)
 */

export type DragItem =
  | { kind: 'folder' | 'notebook'; id: Id; label: string }
  /** A page of a notebook, held in its peek; it can only go to the trash. */
  | { kind: 'page'; id: Id; label: string; notebookId: Id }
export type DropTarget =
  | { kind: 'folder'; id: Id; place: 'inside' | 'before' | 'after' }
  | { kind: 'root' }
  | { kind: 'trash' }

interface DragState {
  item: DragItem
  x: number
  y: number
  over: DropTarget | null
}

/** Holding still this long picks an item up with a finger or pen. */
const HOLD_MS = 380
/** Moving further than this before the hold ends is scrolling, not picking up. */
const SLOP_PX = 10
/** The outer quarters of a folder sort; the middle drops into it. */
const SIDE = 0.25
/** Near the top or bottom edge, the page scrolls along. */
const EDGE_SCROLL_PX = 70
/** Held this close to the bottom of the screen, the trash comes up. */
export const TRASH_BAND_PX = 120

let state: DragState | null = null
const listeners = new Set<() => void>()

function set(next: DragState | null): void {
  state = next
  for (const listener of listeners) listener()
}

export function useDragState(): DragState | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}

/** Looks again what is under the finger, e.g. after something scrolled beneath it. */
export function refreshDropTarget(): void {
  if (state) set({ ...state, over: targetAt(state.x, state.y, state.item) })
}

/** The drop target under a point, for the item being dragged. */
function targetAt(x: number, y: number, item: DragItem): DropTarget | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
  if (!el) return null
  if (el.dataset.drop === 'trash') return { kind: 'trash' }
  if (item.kind === 'page') return null
  if (el.dataset.drop === 'root') return { kind: 'root' }
  const id = el.dataset.dropId
  if (!id || (item.kind === 'folder' && id === item.id)) return null
  if (item.kind === 'notebook' || el.dataset.dropSort === undefined) {
    return { kind: 'folder', id, place: 'inside' }
  }
  // Tiles sort left and right of each other, list rows above and below.
  const r = el.getBoundingClientRect()
  const t = el.dataset.dropAxis === 'y' ? (y - r.top) / r.height : (x - r.left) / r.width
  return { kind: 'folder', id, place: t < SIDE ? 'before' : t > 1 - SIDE ? 'after' : 'inside' }
}

/**
 * Pointer handlers that make an element draggable. `onDrop` gets the target it was dropped on.
 * A tap still works as a tap (the element's click), and a drag never ends in a click.
 */
export function useDraggable(item: DragItem, onDrop: (target: DropTarget) => void) {
  const pending = useRef<{
    pointerId: number
    x: number
    y: number
    timer: ReturnType<typeof setTimeout> | undefined
    mouse: boolean
  } | null>(null)

  const start = (x: number, y: number) => {
    pending.current = null
    navigator.vibrate?.(10)
    set({ item, x, y, over: targetAt(x, y, item) })
    let frame = 0
    // While dragging, the page does not scroll by touch; near an edge it scrolls by itself.
    const stopTouch = (e: TouchEvent) => e.preventDefault()
    const scroll = () => {
      if (!state) return
      // The bottom band belongs to the trash; just above it, the page scrolls down.
      const bottom = window.innerHeight - TRASH_BAND_PX
      const dy =
        state.y < EDGE_SCROLL_PX
          ? -10
          : state.y > bottom - EDGE_SCROLL_PX && state.y < bottom
            ? 10
            : 0
      if (dy) {
        window.scrollBy(0, dy)
        set({ ...state, over: targetAt(state.x, state.y, state.item) })
      }
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    const move = (e: PointerEvent) => {
      if (!state) return
      set({ ...state, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY, item) })
    }
    const end = (e: PointerEvent) => {
      const done = state
      cleanup()
      set(null)
      if (e.type === 'pointerup' && done?.over) onDrop(done.over)
      // The release must not count as a tap on what is under it.
      const swallow = (ev: Event) => {
        ev.stopPropagation()
        ev.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, true), 400)
    }
    const cleanup = () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('touchmove', stopTouch)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    document.addEventListener('touchmove', stopTouch, { passive: false })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const cancel = () => {
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = null
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || state) return
      const mouse = e.pointerType === 'mouse'
      // A mouse drag must not select text on the way.
      if (mouse) e.preventDefault()
      const { clientX: x, clientY: y, pointerId } = e
      pending.current = {
        pointerId,
        x,
        y,
        mouse,
        timer: mouse ? undefined : setTimeout(() => start(x, y), HOLD_MS),
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = pending.current
      if (!p || p.pointerId !== e.pointerId) return
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP_PX
      // A mouse picks up by dragging; a finger that moves first is scrolling.
      if (moved && p.mouse) start(e.clientX, e.clientY)
      else if (moved) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // A long press must not open the system's text selection or link menu.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }
}
