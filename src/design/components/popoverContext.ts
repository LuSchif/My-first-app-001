import { createContext, useContext } from 'react'

export const CloseContext = createContext<() => void>(() => {})

/**
 * The side popovers open on, for a bar that can sit at any edge of the screen: away from that
 * edge. Popovers that name a side keep it.
 */
export const PopoverSideContext = createContext<'top' | 'right' | 'bottom' | 'left'>('bottom')

/** Closes the nearest popover, e.g. once a setting inside it has been chosen. */
export function useClosePopover(): () => void {
  return useContext(CloseContext)
}
