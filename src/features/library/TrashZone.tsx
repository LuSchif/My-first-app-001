import { LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn.ts'
import { refreshDropTarget, TRASH_BAND_PX, useDragState } from './dragDrop.ts'
import { useDeleting } from './trash.ts'

/**
 * The trash: while something is held near the bottom of the screen, it comes up there. Dropped
 * on it, a folder, notebook, presentation or page is deleted (with Undo in a notice).
 */
export function TrashZone() {
  const deleting = useDeleting()
  return (
    <>
      <DropZone />
      {deleting ? <Deleting /> : null}
    </>
  )
}

/** While a deletion runs: a small card at the bottom, so it is clear something happens. */
function Deleting() {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-[79] grid animate-fade-in place-items-center"
    >
      <span className="flex items-center gap-2 rounded-full bg-surface-raised px-5 py-3 font-semibold text-ink shadow-overlay">
        <LoaderCircle size={20} className="animate-spin text-danger" />
        Deleting…
      </span>
    </div>
  )
}

function DropZone() {
  const drag = useDragState()
  const shown = drag !== null && drag.y > window.innerHeight - TRASH_BAND_PX
  const over = drag?.over?.kind === 'trash'

  // Once it is there, it counts as under the finger without waiting for the next move.
  useEffect(() => {
    if (shown) requestAnimationFrame(refreshDropTarget)
  }, [shown])

  if (!shown) return null
  return (
    <div
      data-drop="trash"
      className={cn(
        'fixed inset-x-0 bottom-0 z-[78] grid animate-fade-in place-items-center bg-gradient-to-t pb-[env(safe-area-inset-bottom)] transition-colors',
        over ? 'from-danger/45 to-transparent' : 'from-scrim to-transparent',
      )}
      style={{ height: TRASH_BAND_PX }}
    >
      <span
        className={cn(
          'pointer-events-none flex items-center gap-2 rounded-full px-5 py-3 font-semibold shadow-overlay transition-transform duration-150 ease-gentle',
          over ? 'scale-110 bg-danger text-ink-inverse' : 'bg-surface-raised text-danger',
        )}
      >
        <Trash2 size={22} className={cn('transition-transform', over && '-rotate-12')} />
        <span className="max-w-[60vw] truncate">
          {over ? `Release to delete “${drag.item.label}”` : 'Delete'}
        </span>
      </span>
    </div>
  )
}
