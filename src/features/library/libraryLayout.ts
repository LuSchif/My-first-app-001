import { useStoredState } from './useStoredState.ts'

/** How folders and notebooks are shown: as tiles with their covers, or as a compact list. */
export type LibraryLayout = 'tiles' | 'list'

export function useLibraryLayout(): [LibraryLayout, (layout: LibraryLayout) => void] {
  return useStoredState<LibraryLayout>('broomit.libraryLayout', 'tiles', ['tiles', 'list'])
}
