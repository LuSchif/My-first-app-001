import { ClipboardPaste, Copy, CopyPlus, Scissors, TextCursorInput, Trash2 } from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { Button } from '../../design/index.ts'

const MENU_HEIGHT = 56
const GAP = 14

/** Actions for the lasso selection, floating just above it (or below when there is no room). */
export function SelectionMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const sel = state.selection
  if (!sel) return null
  // Leaves room for the rotate handle above the frame.
  const above = sel.rect.y - MENU_HEIGHT - GAP - 56
  const top = above > 72 ? above : sel.rect.y + sel.rect.height + GAP
  const left = sel.rect.x + sel.rect.width / 2
  return (
    <div
      role="toolbar"
      aria-label={`${sel.count} selected`}
      className="absolute z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
      style={{
        top: Math.max(72, top),
        left: `clamp(12rem, ${left}px, calc(100% - 12rem))`,
      }}
    >
      {sel.textId ? (
        <MenuButton label="Edit text" onClick={() => editor.editSelectedText()}>
          <TextCursorInput size={18} />
        </MenuButton>
      ) : null}
      <MenuButton label="Copy" onClick={() => editor.copySelection()}>
        <Copy size={18} />
      </MenuButton>
      <MenuButton label="Cut" onClick={() => editor.cutSelection()}>
        <Scissors size={18} />
      </MenuButton>
      <MenuButton label="Duplicate" onClick={() => editor.duplicateSelection()}>
        <CopyPlus size={18} />
      </MenuButton>
      <MenuButton label="Delete" onClick={() => editor.deleteSelection()}>
        <Trash2 size={18} />
      </MenuButton>
    </div>
  )
}

function MenuButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
    >
      {children}
      {label}
    </button>
  )
}

/** Shown with the lasso tool when something has been copied and nothing is selected. */
export function PasteButton({ editor, state }: { editor: Editor; state: EditorState }) {
  if (state.tool !== 'lasso' || !state.hasClipboard || state.selection) return null
  return (
    <div className="absolute bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2">
      <Button variant="primary" icon={<ClipboardPaste size={18} />} onClick={() => editor.paste()}>
        Paste on page {state.pageIndex + 1}
      </Button>
    </div>
  )
}
