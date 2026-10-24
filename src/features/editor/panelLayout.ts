import { createContext } from 'react'

/** Bars the user can place along the screen's edges (FloatingPanel): who sits where. */

export type Dock = 'top' | 'bottom' | 'left' | 'right'

/** Space between bars docked at the same edge. */
const GAP = 8

/** Whether the bar around stands upright; dividers and lists follow it. */
export const VerticalContext = createContext(false)

export interface Entry {
  dock: Dock | null
  order: number
  width: number
  height: number
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()
let version = 0

export function layoutVersion(): number {
  return version
}
/** Widths of the top corner groups, which a bar at the top must not cover. */
let corners = { left: 0, right: 0 }

export function topCorners(): { left: number; right: number } {
  return corners
}

function notify(): void {
  version++
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function report(id: string, entry: Entry): void {
  const old = entries.get(id)
  if (
    old &&
    old.dock === entry.dock &&
    old.order === entry.order &&
    Math.abs(old.width - entry.width) < 1 &&
    Math.abs(old.height - entry.height) < 1
  ) {
    return
  }
  entries.set(id, entry)
  notify()
}

/** The top corner groups tell their widths, so a bar at the top can keep clear of them. */
export function setTopCorners(left: number, right: number): void {
  if (Math.abs(corners.left - left) < 1 && Math.abs(corners.right - right) < 1) return
  corners = { left, right }
  notify()
}

/** How far a bar is pushed along its edge's inward direction by bars docked there before it. */
export function stackOffset(id: string, dock: Dock): number {
  const own = entries.get(id)
  if (!own) return 0
  let offset = 0
  for (const [other, e] of entries) {
    if (other === id || e.dock !== dock || e.order >= own.order) continue
    offset += (dock === 'top' || dock === 'bottom' ? e.height : e.width) + GAP
  }
  return offset
}

/** A bar is gone; the others at its edge close up. */
export function unregister(id: string): void {
  if (entries.delete(id)) notify()
}
