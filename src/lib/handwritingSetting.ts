import { useSyncExternalStore } from 'react'

/**
 * Whether handwriting is read by Google's online handwriting recognition (much more accurate;
 * the strokes being read are sent to Google), kept on this device. On by default; when off, or
 * offline, text is read on the device (lib/ocr.ts).
 */
const KEY = 'broomit.onlineHandwriting'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

let on = read()

export function onlineHandwritingOn(): boolean {
  return on
}

export function setOnlineHandwriting(next: boolean): void {
  on = next
  try {
    localStorage.setItem(KEY, next ? 'on' : 'off')
  } catch {
    // Private browsing: the choice lasts until the app closes.
  }
  for (const listener of listeners) listener()
}

export function useOnlineHandwriting(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => on,
  )
}
