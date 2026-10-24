import { useEffect } from 'react'

const TAPPABLE =
  'button, [role="button"], [role="switch"], [role="tab"], [role="menuitem"], a[href]'
const TAP_SLOP_PX = 10

/**
 * Makes Apple Pencil taps on buttons reliable. While a text field is focused, iPadOS treats the
 * Pencil as handwriting input (Scribble) and often swallows the click of a tapped button. A
 * Pencil tap away from a form field therefore ends typing first, and a tap that brought no
 * click clicks the button itself.
 */
export function usePencilTaps(): void {
  useEffect(() => {
    let down: { element: HTMLElement; x: number; y: number } | null = null

    const onDown = (e: PointerEvent) => {
      down = null
      if (e.pointerType !== 'pen') return
      const target = e.target as Element | null
      const active = document.activeElement as HTMLElement | null
      // Form fields only: the page's own text box stays focused while its format bar is used.
      if (
        active?.matches('input') &&
        target &&
        !active.contains(target) &&
        !target.closest('input, textarea, label')
      ) {
        active.blur()
      }
      const element = target?.closest<HTMLElement>(TAPPABLE)
      if (element) down = { element, x: e.clientX, y: e.clientY }
    }

    const onUp = (e: PointerEvent) => {
      const tap = down
      down = null
      if (!tap || e.pointerType !== 'pen') return
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP_PX) return
      const { element } = tap
      let clicked = false
      const mark = () => (clicked = true)
      element.addEventListener('click', mark, { capture: true, once: true })
      // Give the browser's own click a moment; only a missing click is replaced.
      setTimeout(() => {
        element.removeEventListener('click', mark, { capture: true })
        const disabled = (element as HTMLButtonElement).disabled
        if (!clicked && !disabled && element.isConnected) element.click()
      }, 80)
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
    }
  }, [])
}
