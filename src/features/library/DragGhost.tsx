import { FolderInput, Inbox } from 'lucide-react'
import { useDragState } from './dragDrop.ts'

/** What is being dragged, under the finger, and where it would go. */
export function DragGhost() {
  const drag = useDragState()
  if (!drag) return null
  const hint =
    drag.over?.kind === 'root'
      ? 'No folder'
      : drag.over?.kind === 'folder' && drag.over.place === 'inside'
        ? 'Move into folder'
        : drag.over
          ? 'Place here'
          : null
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[80] flex -translate-x-1/2 -translate-y-[130%] items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold whitespace-nowrap text-ink-inverse shadow-overlay"
      style={{ left: drag.x, top: drag.y }}
    >
      {drag.over?.kind === 'root' ? <Inbox size={16} /> : <FolderInput size={16} />}
      <span className="max-w-[16rem] truncate">{drag.item.label}</span>
      {hint ? <span className="font-normal opacity-75">· {hint}</span> : null}
    </div>
  )
}
