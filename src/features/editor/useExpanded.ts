import { useState } from 'react'

/** An open or closed state remembered on this device, e.g. whether the toolbar shows all tools. */
export function useExpanded(key: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const set = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // Remembering is a convenience only.
    }
  }
  return [open, set]
}
