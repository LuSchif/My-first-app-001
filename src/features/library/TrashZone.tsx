import { Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '../../lib/cn.ts'
import { refreshDropTarget, TRASH_BAND_PX, useDragState } from './dragDrop.ts'

/**
 * The trash: while something is held near the bottom of the screen, it comes up there. Dropped
 * on it, a folder, notebook, presentation or page is deleted (with Undo in a notice).
 */
export function TrashZone() {
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
