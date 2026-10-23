import { createContext, useContext } from 'react'

export const CloseContext = createContext<() => void>(() => {})

/** Closes the nearest popover, e.g. once a setting inside it has been chosen. */
export function useClosePopover(): () => void {
  return useContext(CloseContext)
}
