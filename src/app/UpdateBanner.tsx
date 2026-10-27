import { RefreshCw } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isUpdateReady, onUpdateReady } from '../lib/install.ts'
import { publishedRelease } from '../lib/release.ts'
import { releaseLabel } from '../release.ts'

/** Offers to reload once a newer version of Broomit is installed, and names it. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(onUpdateReady, isUpdateReady)
  const [next, setNext] = useState<string | null>(null)
  useEffect(() => {
    if (!ready) return
    let current = true
    void publishedRelease().then((release) => {
      if (current && release) setNext(releaseLabel(release))
    })
    return () => {
      current = false
    }
  }, [ready])
  if (!ready) return null
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="fixed bottom-[calc(16px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-pop-in items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ink-inverse shadow-overlay"
    >
      <RefreshCw size={16} /> {next ?? 'New version'} ready · Tap to update
    </button>
  )
}
