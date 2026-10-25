import { useSyncExternalStore } from 'react'

/**
 * A look into a notebook, presentation or folder before opening it: what is in it, shown over
 * the library (see `Peek.tsx`).
 */
export type PeekTarget = { kind: 'notebook' | 'folder'; id: string } | null

let target: PeekTarget = null
const listeners = new Set<() => void>()

export function openPeek(next: PeekTarget): void {
  target = next
  for (const listener of listeners) listener()
}

export function usePeek(): PeekTarget {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => target,
  )
}
