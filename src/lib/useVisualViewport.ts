import { useSyncExternalStore } from 'react'

/**
 * The visible part of the layout viewport. On iPadOS the on-screen keyboard shrinks it, so UI
 * placed against its bottom edge sits right above the keyboard.
 */
export function useVisualViewportBottom(): number {
  return useSyncExternalStore(subscribe, snapshot)
}

function snapshot(): number {
  const vv = window.visualViewport
  return vv ? Math.round(vv.offsetTop + vv.height) : window.innerHeight
}

function subscribe(onChange: () => void): () => void {
  const vv = window.visualViewport
  vv?.addEventListener('resize', onChange)
  vv?.addEventListener('scroll', onChange)
  window.addEventListener('resize', onChange)
  return () => {
    vv?.removeEventListener('resize', onChange)
    vv?.removeEventListener('scroll', onChange)
    window.removeEventListener('resize', onChange)
  }
}
