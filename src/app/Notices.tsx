import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { currentNotices, dismissNotice, subscribeNotices } from '../lib/notices.ts'

/** The notices of `lib/notices.ts`, at the bottom of the screen. */
export function Notices() {
  const notices = useSyncExternalStore(subscribeNotices, currentNotices)
  if (!notices.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[75] grid justify-items-center gap-2 px-3">
      {notices.map((n) => (
        <div
          key={n.id}
          role="status"
          className="pointer-events-auto flex max-w-md animate-pop-in items-center gap-2 rounded-panel bg-ink py-1.5 pr-1.5 pl-4 text-sm text-ink-inverse shadow-overlay"
        >
          <span className="min-w-0 flex-1">{n.text}</span>
          {n.action ? (
            <button
              type="button"
              onClick={() => {
                dismissNotice(n.id)
                n.action?.run()
              }}
              className="h-10 rounded-control px-3 font-semibold text-accent hover:bg-white/10"
            >
              {n.action.label}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissNotice(n.id)}
            className="grid size-10 place-items-center rounded-control hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
