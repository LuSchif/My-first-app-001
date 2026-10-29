import { createContext, useContext } from 'react'
import type { Id } from '../../engine/model/types.ts'

/**
 * Choosing several items on a home screen page ("Select"): a tap then marks an item instead of
 * looking inside, and what is marked moves, goes into a group or is deleted together (from the
 * bar at the bottom, or by dragging one of them).
 */
export interface LibrarySelection {
  ids: Id[]
  has: (id: Id) => boolean
  toggle: (id: Id) => void
  clear: () => void
}

const SelectionContext = createContext<LibrarySelection | null>(null)
export const SelectionProvider = SelectionContext.Provider

/** The selection of the page a card is on, or null when not selecting. */
export function useLibrarySelection(): LibrarySelection | null {
  return useContext(SelectionContext)
}
