import { useEffect } from 'react'
import { indexAt, showMirror } from './fieldMirror.ts'
import {
  activate,
  backspace,
  close,
  enter,
  isTextField,
  keyboardState,
  moveCaret,
  onKeyboardChange,
  select,
  selectAll,
  selection,
  selectWord,
  virtualKeyboardEnabled,
  type,
  type Field,
} from './keyboardStore.ts'

/** How long after touching a field it may become the keyboard's target because of it. */
const TAP_WINDOW_MS = 1500
/** A second tap this soon and this close selects a word. */
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24
/** Moving further than this while pressing selects text instead of placing the caret. */
const DRAG_PX = 8

interface Press {
  field: Field
  pointerId: number
  x: number
  y: number
  /** Where the press started in the text, for a drag selection. */
  anchor: number | null
  dragging: boolean
}

/**
 * Routes text input on iPad to Broomit's own keyboard: taps on text fields never focus them (so
 * iPadOS shows nothing), they make the field the keyboard's target instead. A connected hardware
 * keyboard types into the same field. Returns whether this mode is on.
 */
export function useVirtualKeyboard(): boolean {
  const enabled = virtualKeyboardEnabled()

  useEffect(() => {
    if (!enabled) return
    document.documentElement.setAttribute('data-own-keyboard', '')
    let touched: { field: Field; time: number } | null = null
    let press: Press | null = null
    /** A tap outside the field being typed into, which ends typing once it is complete. */
    let closeAfter: { pointerId: number; field: Field } | null = null
    let lastTap: { field: Field; x: number; y: number; time: number } | null = null

    // The mirror draws the caret and selection; it follows every change, and the field's place
    // (a text box moves with the page) once per frame.
    let frame = 0
    const redraw = () => {
      frame = 0
      const field = keyboardState().field
      showMirror(field, selection())
      if (field) frame = requestAnimationFrame(redraw)
    }
    // While typing, the next frame shows the change: a burst of keys costs one redraw.
    const stopWatching = onKeyboardChange(() => {
      if (!keyboardState().field) {
        cancelAnimationFrame(frame)
        redraw()
      } else if (!frame) {
        frame = requestAnimationFrame(redraw)
      }
    })

    const fieldAt = (target: EventTarget | null): Field | null => {
      const el = (target as Element | null)?.closest?.('input, textarea')
      return isTextField(el) ? el : null
    }
    const inKeyboard = (target: EventTarget | null) =>
      Boolean(
        (target as Element | null)?.closest?.(
          '[data-virtual-keyboard], [data-keep-keyboard], [data-radix-popper-content-wrapper]',
        ),
      )

    // A finger or Pencil on a field: no focus, no Scribble, no system bar.
    const onTouchStart = (e: TouchEvent) => {
      const field = fieldAt(e.target)
      if (!field) return
      e.preventDefault()
      touched = { field, time: performance.now() }
    }
    const onPointerDown = (e: PointerEvent) => {
      const field = fieldAt(e.target)
      if (field) {
        e.preventDefault()
        touched = { field, time: performance.now() }
        const active = keyboardState().field === field
        press = {
          field,
          pointerId: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          anchor: active ? indexAt(field, e.clientX, e.clientY) : null,
          dragging: false,
        }
        return
      }
      // Touching anything else ends typing, except the keyboard and bars made for typing. The
      // page's own text box ends typing itself when its editing ends.
      // It closes once the tap is complete: closing earlier moves what is under the finger
      // (a dialog re-centers), and the tap would miss its button.
      const active = keyboardState().field
      if (active && active.dataset.allowFocus === undefined && !inKeyboard(e.target)) {
        closeAfter = { pointerId: e.pointerId, field: active }
      }
    }
    // Dragging across the text being typed selects it.
    const onPointerMove = (e: PointerEvent) => {
      const p = press
      if (!p || p.pointerId !== e.pointerId || p.anchor === null) return
      if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return
      p.dragging = true
      e.preventDefault()
      const at = indexAt(p.field, e.clientX, e.clientY)
      if (at !== null) select(p.anchor, at)
    }
    // A tap places the caret (and opens the keyboard); a quick second tap selects the word.
    const onPointerUp = (e: PointerEvent) => {
      if (closeAfter?.pointerId === e.pointerId) {
        const { field } = closeAfter
        closeAfter = null
        // After the tap's click; unless the tap gave the keyboard another field meanwhile.
        setTimeout(() => {
          if (keyboardState().field === field) close()
        }, 0)
      }
      const p = press
      if (!p || p.pointerId !== e.pointerId) return
      press = null
      if (p.dragging || !p.field.isConnected) return
      const now = performance.now()
      const at = indexAt(p.field, e.clientX, e.clientY) ?? undefined
      const double =
        lastTap?.field === p.field &&
        now - lastTap.time < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX
      lastTap = double ? null : { field: p.field, x: e.clientX, y: e.clientY, time: now }
      if (keyboardState().field !== p.field) activate(p.field, at)
      else if (double && at !== undefined) selectWord(at)
      else if (at !== undefined) select(at)
    }
    const onPointerCancel = (e: PointerEvent) => {
      if (closeAfter?.pointerId === e.pointerId) {
        closeAfter = null
        close()
      }
      if (press?.pointerId === e.pointerId) press = null
    }
    // Focus from code or a trackpad click: take the field over instead.
    const onFocusIn = (e: FocusEvent) => {
      const field = e.target
      if (!isTextField(field)) return
      field.blur()
      const asked =
        field.dataset.allowFocus !== undefined ||
        (touched?.field === field && performance.now() - touched.time < TAP_WINDOW_MS)
      if (asked) activate(field)
    }
    // The page's own text box asks for typing with this event instead of focusing.
    const onType = (e: Event) => {
      if (isTextField(e.target)) activate(e.target)
    }
    const onDone = (e: Event) => {
      if (keyboardState().field === e.target) close()
    }
    // A hardware keyboard types into the same field.
    const onKeyDown = (e: KeyboardEvent) => {
      if (!keyboardState().field || e.altKey) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }
      if (e.metaKey || e.ctrlKey) return
      let handled = true
      if (e.key === 'Backspace') backspace()
      else if (e.key === 'Enter') enter()
      else if (e.key === 'ArrowLeft') moveCaret(-1, e.shiftKey)
      else if (e.key === 'ArrowRight') moveCaret(1, e.shiftKey)
      else if (e.key === 'Escape') close()
      else if (e.key.length === 1) type(e.key, true)
      else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerCancel, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('broomit:type', onType, true)
    document.addEventListener('broomit:done', onDone, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.documentElement.removeAttribute('data-own-keyboard')
      document.removeEventListener('touchstart', onTouchStart, { capture: true })
      stopWatching()
      cancelAnimationFrame(frame)
      showMirror(null, { start: 0, end: 0 })
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, { capture: true })
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('broomit:type', onType, true)
      document.removeEventListener('broomit:done', onDone, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [enabled])

  return enabled
}
