import { useSyncExternalStore } from 'react'
import { showNotice } from '../../lib/notices.ts'

/**
 * Deleting by dropping on the trash: what was dropped disappears at once but is only deleted
 * for good a few seconds later, so the notice can undo it. Until then its id is in `hidden`.
 */

/** A little longer than a notice stays, so Undo works for as long as it shows. */
const COMMIT_MS = 6500

let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function setHidden(next: ReadonlySet<string>): void {
  hidden = next
  for (const listener of listeners) listener()
}

/** The ids of folders, notebooks and pages that are on their way out. */
export function useTrashed(): ReadonlySet<string> {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => hidden,
  )
}

/**
 * Hides `ids`, says `text` with an Undo, and runs `commit` (the real deletion) unless undone;
 * then `onDone`, e.g. to reload what is shown.
 */
export function moveToTrash(
  ids: string[],
  text: string,
  commit: () => Promise<void>,
  onDone: () => void,
): void {
  setHidden(new Set([...hidden, ...ids]))
  const restore = () => setHidden(new Set([...hidden].filter((id) => !ids.includes(id))))
  const timer = setTimeout(() => {
    commit()
      .catch((err: unknown) => console.error(err))
      .finally(() => {
        onDone()
        restore()
      })
  }, COMMIT_MS)
  showNotice(text, {
    label: 'Undo',
    run: () => {
      clearTimeout(timer)
      restore()
    },
  })
}
