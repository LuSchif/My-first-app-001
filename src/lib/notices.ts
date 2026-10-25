/**
 * Short messages at the bottom of the screen, e.g. "Moved … to …", optionally with one action
 * such as Undo. A notice goes away by itself after a few seconds.
 */
export interface Notice {
  id: number
  text: string
  action?: { label: string; run: () => void }
}

const SHOWN_MS = 6000

let notices: Notice[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function subscribeNotices(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentNotices(): Notice[] {
  return notices
}

export function showNotice(text: string, action?: Notice['action']): void {
  const id = nextId++
  // One at a time: a new notice replaces the one before.
  notices = [{ id, text, action }]
  emit()
  setTimeout(() => dismissNotice(id), SHOWN_MS)
}

export function dismissNotice(id: number): void {
  if (!notices.some((n) => n.id === id)) return
  notices = notices.filter((n) => n.id !== id)
  emit()
}
