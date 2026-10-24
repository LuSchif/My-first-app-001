import { EyeOff, Layers, Lock, X } from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'

const WIDTH = 288

/** What the magnifier found under it: each object with its layer, and a way to that layer. */
export function InspectCard({ editor, state }: { editor: Editor; state: EditorState }) {
  const inspect = state.inspect
  if (!inspect) return null
  // Below the spot, kept on screen.
  const left = `clamp(12px, ${inspect.x - WIDTH / 2}px, calc(100% - ${WIDTH + 12}px))`
  const below = inspect.y + 24
  const top = below + 260 > window.innerHeight ? Math.max(12, inspect.y - 280) : below
  return (
    <div
      role="dialog"
      aria-label="Under the magnifier"
      className="absolute z-20 grid max-h-64 animate-pop-in gap-1 overflow-y-auto rounded-panel bg-surface-raised p-2 shadow-overlay ring-1 ring-line"
      style={{ left, top, width: WIDTH }}
    >
      <div className="flex items-center justify-between px-2 pt-1">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {inspect.items.length ? 'Under the magnifier' : 'Nothing here'}
        </p>
        <button
          type="button"
          aria-label="Close"
          onClick={() => editor.closeInspect()}
          className="grid size-8 place-items-center rounded-control text-ink-muted hover:bg-hover"
        >
          <X size={16} />
        </button>
      </div>
      {inspect.items.map((item) => {
        const active = item.layerId === state.activeLayerId
        return (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-hover"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{item.label}</span>
              <span className="flex items-center gap-1 text-xs text-ink-muted">
                <Layers size={12} className="shrink-0" />
                <span className="truncate">{item.layerName}</span>
                {item.hidden ? <EyeOff size={12} className="shrink-0 text-danger" /> : null}
                {item.locked ? <Lock size={12} className="shrink-0 text-danger" /> : null}
              </span>
            </span>
            {active ? (
              <span className="px-2 text-xs font-semibold text-ink-muted">Active layer</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  editor.setActiveLayer(item.layerId)
                  editor.closeInspect()
                }}
                className="h-9 shrink-0 rounded-control bg-ink px-3 text-xs font-semibold text-ink-inverse"
              >
                Go to layer
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
