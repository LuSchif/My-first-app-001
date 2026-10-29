import { useSyncExternalStore } from 'react'
import type { Id } from '../../engine/model/types.ts'
import { showNotice } from '../../lib/notices.ts'
import { restoreSnapshot, takeSnapshot } from '../../storage/snapshot.ts'

/**
 * Deleting by dropping on the trash (or "Delete" for a selection). What is dropped disappears
 * at once and is deleted right away, while a copy is kept in memory: the notice's Undo puts it
 * back. Deleting at once means nothing comes back when the app is closed or paused right
 * after (iPadOS stops timers of an app in the background).
 */

interface TrashState {
  /** The ids of folders, notebooks and pages that were deleted (or are being deleted). */
  hidden: ReadonlySet<string>
  /** How many deletions are running; while one is, "Deleting…" shows. */
  busy: number
}

let state: TrashState = { hidden: new Set(), busy: 0 }
const listeners = new Set<() => void>()

function set(patch: Partial<TrashState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useTrashed(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => state.hidden)
}

/** Whether a deletion is running. */
export function useDeleting(): boolean {
  return useSyncExternalStore(subscribe, () => state.busy > 0)
}

/** What is deleted: folders (with everything in them), notebooks, or pages of a notebook. */
export interface TrashWhat {
  folderIds?: Id[]
  notebookIds?: Id[]
  pageIds?: Id[]
}

/**
 * Hides `ids`, copies what `what` names, runs `commit` (the deletion) and says `text` with an
 * Undo that restores the copy; `onDone` runs after deleting and after an Undo, e.g. to reload.
 */
export function moveToTrash(
  ids: string[],
  text: string,
  what: TrashWhat,
  commit: () => Promise<void>,
  onDone: () => void,
): void {
  set({ hidden: new Set([...state.hidden, ...ids]), busy: state.busy + 1 })
  const unhide = () => set({ hidden: new Set([...state.hidden].filter((id) => !ids.includes(id))) })
  const run = async () => {
    const snapshot = await takeSnapshot(what)
    await commit()
    return snapshot
  }
  run()
    .then((snapshot) => {
      showNotice(text, {
        label: 'Undo',
        run: () => {
          restoreSnapshot(snapshot)
            .then(unhide)
            .catch((err: unknown) => {
              console.error(err)
              showNotice('It could not be brought back.')
            })
            .finally(onDone)
        },
      })
    })
    .catch((err: unknown) => {
      console.error(err)
      // Nothing (or not everything) was deleted: show it again.
      unhide()
      showNotice('It could not be deleted. Try again.')
    })
    .finally(() => {
      set({ busy: state.busy - 1 })
      onDone()
    })
}
