import { useSyncExternalStore } from 'react'

/** Whether the frame rate is shown on screen (a check for smoothness), kept on this device. */
const KEY = 'broomit.showFrameRate'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

let shown = read()

export function setFrameRateShown(on: boolean): void {
  shown = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // Private browsing: the choice lasts until the app closes.
  }
  for (const listener of listeners) listener()
}

export function useFrameRateShown(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => shown,
  )
}
