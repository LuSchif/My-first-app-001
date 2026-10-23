import { useEffect } from 'react'

/**
 * Keeps a full-screen view (the editor) where it belongs. iPadOS can leave the page scrolled or
 * zoomed, e.g. after the keyboard of a dialog or an accidental pinch in the library; the
 * editor's toolbar would then sit outside the visible area, and the editor's own gestures
 * cannot scroll it back.
 */
export function useFixedViewport(): void {
  useEffect(() => {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    resetZoom()
    const settle = () => {
      const typing = document.activeElement?.matches('input, textarea, [contenteditable]')
      if (!typing && (window.scrollX !== 0 || window.scrollY !== 0)) window.scrollTo(0, 0)
    }
    settle()
    const vv = window.visualViewport
    vv?.addEventListener('resize', settle)
    vv?.addEventListener('scroll', settle)
    window.addEventListener('scroll', settle)
    return () => {
      vv?.removeEventListener('resize', settle)
      vv?.removeEventListener('scroll', settle)
      window.removeEventListener('scroll', settle)
    }
  }, [])
}

/** WebKit zooms back out when the viewport briefly forbids zoom. */
function resetZoom(): void {
  const scale = window.visualViewport?.scale ?? 1
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (!meta || Math.abs(scale - 1) < 0.01) return
  const original = meta.content
  meta.content = `${original}, maximum-scale=1`
  setTimeout(() => (meta.content = original), 300)
}
