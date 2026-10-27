import { Check, Spline, Trash2 } from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'

const GAP = 28

/** Actions for the path tool: next to the selected anchor point, or a hint while none is. */
export function PathMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const info = state.pathEdit
  if (state.tool !== 'path') return null
  if (!info) {
    return (
      <p className="pointer-events-none absolute inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-10 mx-auto w-fit max-w-[calc(100%-24px)] rounded-panel bg-surface-raised/95 px-4 py-3 text-sm font-semibold shadow-raised">
        Tap a stroke to edit its points
      </p>
    )
  }
  const button =
    'flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15 disabled:opacity-40'
  const body = (
    <>
      {info.anchor ? (
        <>
          <button
            type="button"
            className={button}
            disabled={!info.canDelete}
            onClick={() => editor.deletePathPoint()}
          >
            <Trash2 size={18} />
            Delete point
          </button>
          <span aria-hidden="true" className="mx-1 h-7 w-px bg-white/20" />
          <button type="button" className={button} onClick={() => editor.togglePathPointSmooth()}>
            <Spline size={18} />
            {info.smooth ? 'Make corner' : 'Make smooth'}
          </button>
        </>
      ) : (
        <span className="px-3 text-sm">Drag a point · tap the line to add one</span>
      )}
      <button type="button" className={button} onClick={() => editor.finishPathEdit()}>
        <Check size={18} />
        Done
      </button>
    </>
  )
  const style = info.anchor
    ? {
        top: Math.max(72, info.anchor.y - 56 - GAP),
        left: `clamp(10rem, ${info.anchor.x}px, calc(100% - 10rem))`,
      }
    : undefined
  return (
    <div
      role="toolbar"
      aria-label="Path point"
      className={
        info.anchor
          ? 'absolute z-10 flex w-max -translate-x-1/2 items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay'
          : 'absolute inset-x-0 bottom-[calc(20px+env(safe-area-inset-bottom))] z-10 mx-auto flex w-fit items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay'
      }
      style={style}
    >
      {body}
    </div>
  )
}
