import type { Fill } from '../../engine/model/fill.ts'

/** Covers the user designed and saved, to use again for other notebooks (kept on this device). */
const KEY = 'broomit.coverDesigns'
const LIMIT = 16

export function loadCoverDesigns(): Fill[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? (value as Fill[]).filter(isFill) : []
  } catch {
    return []
  }
}

/** Saves a design first in the list; an identical one is not saved twice. */
export function saveCoverDesign(fill: Fill): Fill[] {
  const key = JSON.stringify(fill)
  const next = [fill, ...loadCoverDesigns().filter((f) => JSON.stringify(f) !== key)].slice(
    0,
    LIMIT,
  )
  write(next)
  return next
}

export function removeCoverDesign(fill: Fill): Fill[] {
  const key = JSON.stringify(fill)
  const next = loadCoverDesigns().filter((f) => JSON.stringify(f) !== key)
  write(next)
  return next
}

function write(designs: Fill[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(designs))
  } catch {
    // Not stored; the design can still be used for this notebook.
  }
}

function isFill(value: unknown): value is Fill {
  if (!value || typeof value !== 'object') return false
  const v = value as { type?: unknown; color?: unknown; stops?: unknown }
  if (v.type === 'solid') return typeof v.color === 'string'
  return (v.type === 'linear' || v.type === 'radial') && Array.isArray(v.stops)
}
