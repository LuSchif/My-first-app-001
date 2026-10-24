import { MoveUpRight, Music, PaintBucket, Shapes, Table2, X } from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'

const CHIP_HEIGHT = 48
const GAP = 12

/** Offers Auto shape, Auto fill or Auto table right above what was just drawn. */
export function SuggestionChip({ editor, state }: { editor: Editor; state: EditorState }) {
  const s = state.suggestion
  if (!s || state.selection) return null
  const above = s.rect.y - CHIP_HEIGHT - GAP
  const top = above > 72 ? above : s.rect.y + s.rect.height + GAP
  const left = s.rect.x + s.rect.width / 2
  return (
    <div
      className="absolute z-10 flex w-max -translate-x-1/2 animate-pop-in items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
      style={{ top, left: `clamp(10rem, ${left}px, calc(100% - 10rem))` }}
    >
      <button
        type="button"
        onClick={() => editor.acceptSuggestion()}
        className="flex h-10 items-center gap-2 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
      >
        {s.kind === 'fill' ? (
          <PaintBucket size={18} />
        ) : s.kind === 'table' ? (
          <Table2 size={18} />
        ) : s.kind === 'arrow' ? (
          <MoveUpRight size={18} />
        ) : s.kind === 'clef' ? (
          <Music size={18} />
        ) : (
          <Shapes size={18} />
        )}
        {s.label}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => editor.dismissSuggestion()}
        className="grid size-10 place-items-center rounded-control text-ink-inverse/70 hover:bg-white/10"
      >
        <X size={16} />
      </button>
    </div>
  )
}
