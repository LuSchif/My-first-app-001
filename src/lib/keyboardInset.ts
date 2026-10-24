/**
 * Height of Broomit's own on-screen keyboard, so the editor and dialogs keep what is being typed
 * above it. Plain module state: the keyboard writes it, layout code reads it.
 */
let height = 0
const listeners = new Set<() => void>()

export function keyboardInset(): number {
  return height
}

export function setKeyboardInset(next: number): void {
  if (next === height) return
  height = next
  document.documentElement.style.setProperty('--kb-height', `${next}px`)
  for (const listener of listeners) listener()
}

export function onKeyboardInset(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
