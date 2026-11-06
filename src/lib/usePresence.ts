import { useEffect, useState } from 'react'

/**
 * Keeps something shown for `ms` after it was closed, so it can animate out: `shown` is true
 * while it is open or closing, `closing` while it animates out.
 */
export function usePresence(open: boolean, ms = 200): { shown: boolean; closing: boolean } {
  const [shown, setShown] = useState(open)
  if (open && !shown) setShown(true)
  useEffect(() => {
    if (open || !shown) return
    const timer = setTimeout(() => setShown(false), ms)
    return () => clearTimeout(timer)
  }, [open, shown, ms])
  return { shown: open || shown, closing: !open && shown }
}
