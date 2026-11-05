import { useSyncExternalStore } from 'react'
import type { Addon } from '../../../engine/addons/types.ts'

/**
 * The person's addon library, kept on this device: every addon they added or made, with its
 * settings and name. Each notebook remembers which of them were switched on in it; an addon
 * marked "always" is on in every notebook.
 */
const LIBRARY_KEY = 'broomit.addons'
const onKey = (notebookId: string) => `broomit.addons.on.${notebookId}`

const listeners = new Set<() => void>()
let library: Addon[] = read(LIBRARY_KEY, [])
const switchedOn = new Map<string, string[]>()

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private browsing or full storage: the library lasts until the app closes.
  }
}

function changed(): void {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useAddonLibrary(): Addon[] {
  return useSyncExternalStore(subscribe, () => library)
}

/** Adds an addon to the library, or replaces the one with the same id. */
export function saveAddon(addon: Addon): void {
  const i = library.findIndex((a) => a.id === addon.id)
  library = i < 0 ? [...library, addon] : library.map((a) => (a.id === addon.id ? addon : a))
  write(LIBRARY_KEY, library)
  changed()
}

export function removeAddon(id: string): void {
  library = library.filter((a) => a.id !== id)
  write(LIBRARY_KEY, library)
  changed()
}

/** Moves an addon one place up (-1) or down (1) in the library. */
export function moveAddon(id: string, by: -1 | 1): void {
  const i = library.findIndex((a) => a.id === id)
  const j = i + by
  if (i < 0 || j < 0 || j >= library.length) return
  const next = [...library]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  library = next
  write(LIBRARY_KEY, library)
  changed()
}

function onIn(notebookId: string): string[] {
  let ids = switchedOn.get(notebookId)
  if (!ids) {
    ids = read<string[]>(onKey(notebookId), [])
    switchedOn.set(notebookId, ids)
  }
  return ids
}

/** Switches an addon on or off in one notebook. */
export function switchAddon(notebookId: string, id: string, on: boolean): void {
  const ids = onIn(notebookId).filter((x) => x !== id)
  if (on) ids.push(id)
  switchedOn.set(notebookId, ids)
  write(onKey(notebookId), ids)
  changed()
}

/** The ids of the addons switched on in a notebook (not counting "always" ones). */
export function useSwitchedOn(notebookId: string): string[] {
  return useSyncExternalStore(subscribe, () => onIn(notebookId))
}

/** Whether an addon is on in a notebook. */
export function isOn(addon: Addon, switched: readonly string[]): boolean {
  return addon.always || switched.includes(addon.id)
}

/** A name not used by another addon in the library: "Name", "Name 2", … */
export function freeName(name: string, except?: string): string {
  const taken = new Set(library.filter((a) => a.id !== except).map((a) => a.name))
  if (!taken.has(name)) return name
  for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`)) return `${name} ${n}`
}
