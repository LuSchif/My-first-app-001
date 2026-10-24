import { RefreshCw } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { isUpdateReady, onUpdateReady } from '../lib/install.ts'

/** Offers to reload once a newer version of Broomit is installed. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(onUpdateReady, isUpdateReady)
  if (!ready) return null
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-pop-in items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse shadow-overlay"
    >
      <RefreshCw size={16} /> New version ready · Tap to update
    </button>
  )
}
