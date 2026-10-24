import { useRef, useState } from 'react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'

const DRAG_PX = 8
/** The dragged chip floats above the finger so the drop point stays visible. */
const LIFT_PX = 44

/**
 * The colors used in this notebook (up to five) on the right edge. Tap one to use it; drag one onto ink or text to
 * recolor it, or onto empty paper to color the whole page.
 */
export function RecentColors({ editor, state }: { editor: Editor; state: EditorState }) {
  const drag = useRef<{ id: number; x: number; y: number; color: string; moved: boolean } | null>(
    null,
  )
  const [ghost, setGhost] = useState<{ x: number; y: number; color: string } | null>(null)

  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setGhost(null)
    if (cancelled) editor.endColorPreview()
    else if (d.moved) editor.dropColor(e.clientX, e.clientY - LIFT_PX, d.color)
    else editor.applyColor(d.color)
  }

  // Empty until the first color is used in this notebook.
  if (state.recentColors.length === 0) return null

  return (
    <>
      <div
        role="toolbar"
        aria-label="Recent colors"
        aria-orientation="vertical"
        className="pointer-events-auto absolute top-1/2 right-[max(12px,env(safe-area-inset-right))] z-10 flex -translate-y-1/2 flex-col gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur"
      >
        {state.recentColors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use color ${color}`}
            title="Tap to use, drag onto ink, text or paper to color it"
            className="grid size-11 touch-none place-items-center rounded-full"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, color, moved: false }
            }}
            onPointerMove={(e) => {
              const d = drag.current
              if (!d || d.id !== e.pointerId) return
              if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_PX) return
              d.moved = true
              setGhost({ x: e.clientX, y: e.clientY - LIFT_PX, color })
              editor.previewColorDrop(e.clientX, e.clientY - LIFT_PX, color)
            }}
            onPointerUp={(e) => end(e, false)}
            onPointerCancel={(e) => end(e, true)}
          >
            <span
              className="size-8 rounded-full shadow-[inset_0_0_0_1px_rgb(62_45_37/0.16)]"
              style={{ background: color }}
            />
          </button>
        ))}
      </div>
      {ghost ? (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-50 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-overlay ring-4 ring-surface-raised"
          style={{ left: ghost.x, top: ghost.y, background: ghost.color }}
        />
      ) : null}
    </>
  )
}
