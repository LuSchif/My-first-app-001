import { FolderInput, Inbox } from 'lucide-react'
import { dragLabel, useDragState } from './dragDrop.ts'

/** What is being dragged, under the finger, and where it would go. */
export function DragGhost() {
  const drag = useDragState()
  // Over the trash, the trash itself says what is about to go.
  if (!drag || drag.over?.kind === 'trash') return null
  const hint =
    drag.over?.kind === 'root'
      ? 'No folder'
      : drag.over?.kind === 'folder' && drag.over.place === 'inside'
        ? 'Move into folder'
        : drag.over?.kind === 'group'
          ? 'Add to group'
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
      <span className="max-w-[16rem] truncate">{dragLabel(drag.item)}</span>
      {hint ? <span className="font-normal opacity-75">· {hint}</span> : null}
    </div>
  )
}
