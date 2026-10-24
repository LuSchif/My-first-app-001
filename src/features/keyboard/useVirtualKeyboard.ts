import { useEffect } from 'react'
import {
  activate,
  backspace,
  close,
  enter,
  isTextField,
  keyboardState,
  virtualKeyboardEnabled,
  type,
  type Field,
} from './keyboardStore.ts'

/** How long after touching a field it may become the keyboard's target because of it. */
const TAP_WINDOW_MS = 1500

/**
 * Routes text input on iPad to Broomit's own keyboard: taps on text fields never focus them (so
 * iPadOS shows nothing), they make the field the keyboard's target instead. A connected hardware
 * keyboard types into the same field. Returns whether this mode is on.
 */
export function useVirtualKeyboard(): boolean {
  const enabled = virtualKeyboardEnabled()

  useEffect(() => {
    if (!enabled) return
    document.documentElement.setAttribute('data-virtual-keyboard', '')
    let touched: { field: Field; time: number } | null = null

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
    const onTouchEnd = () => {
      const t = touched
      touched = null
      if (t && performance.now() - t.time < TAP_WINDOW_MS && t.field.isConnected) activate(t.field)
    }
    const onPointerDown = (e: PointerEvent) => {
      const field = fieldAt(e.target)
      if (field) {
        touched = { field, time: performance.now() }
        return
      }
      // Touching anything else ends typing, except the keyboard and bars made for typing.
      if (keyboardState().field && !inKeyboard(e.target)) close()
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
      if (!keyboardState().field || e.metaKey || e.ctrlKey || e.altKey) return
      let handled = true
      if (e.key === 'Backspace') backspace()
      else if (e.key === 'Enter') enter()
      else if (e.key === 'Escape') close()
      else if (e.key.length === 1) type(e.key, true)
      else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    document.addEventListener('touchend', onTouchEnd, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('broomit:type', onType, true)
    document.addEventListener('broomit:done', onDone, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.documentElement.removeAttribute('data-virtual-keyboard')
      document.removeEventListener('touchstart', onTouchStart, { capture: true })
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('broomit:type', onType, true)
      document.removeEventListener('broomit:done', onDone, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [enabled])

  return enabled
}
