import { useEffect } from 'react'

/** How long after a tap a field may take focus because of it. */
const TAP_WINDOW_MS = 1200

/**
 * Text fields only take focus when they are tapped. On iPad, a focused field brings up the
 * keyboard (or, without one, the bare bar above it), so a field focused by code (a menu opening,
 * a dialog appearing) would show it without being asked. Fields that are focused on purpose by
 * code, like the text box on the page, carry `data-allow-focus`.
 */
export function useRequestedFocus(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    let last: { target: Element; time: number } | null = null
    let keyAt = 0

    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element) last = { target: e.target, time: performance.now() }
    }
    const onKeyDown = () => {
      keyAt = performance.now()
    }
    const onFocusIn = (e: FocusEvent) => {
      const field = e.target
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return
      if (field.dataset.allowFocus !== undefined || field.readOnly) return
      const now = performance.now()
      // Keyboard users move between fields with Tab.
      if (now - keyAt < TAP_WINDOW_MS) return
      const tapped =
        last &&
        now - last.time < TAP_WINDOW_MS &&
        (field.contains(last.target) ||
          last.target.contains(field) ||
          last.target.closest('label')?.control === field)
      if (!tapped) field.blur()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [enabled])
}
