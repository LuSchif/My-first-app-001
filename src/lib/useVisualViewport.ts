import { useSyncExternalStore } from 'react'
import { keyboardInset, onKeyboardInset } from './keyboardInset.ts'

/**
 * The visible part of the layout viewport. On iPadOS the on-screen keyboard shrinks it, so UI
 * placed against its bottom edge sits right above the keyboard.
 */
export function useVisualViewportBottom(): number {
  return useSyncExternalStore(subscribe, snapshot)
}

function snapshot(): number {
  const vv = window.visualViewport
  const bottom = vv ? Math.round(vv.offsetTop + vv.height) : window.innerHeight
  // The app's own keyboard covers the bottom without shrinking the viewport.
  return Math.min(bottom, window.innerHeight - keyboardInset())
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport
  vv?.addEventListener('resize', onChange)
  vv?.addEventListener('scroll', onChange)
  window.addEventListener('resize', onChange)
  const stopInset = onKeyboardInset(onChange)
  return () => {
    stopInset()
    vv?.removeEventListener('resize', onChange)
    vv?.removeEventListener('scroll', onChange)
    window.removeEventListener('resize', onChange)
  }
}
