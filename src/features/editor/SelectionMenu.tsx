import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  Scaling,
  Scissors,
  TextCursorInput,
  Trash2,
} from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { Button, ColorPicker, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'

const MENU_HEIGHT = 56
const GAP = 14

/** Actions for the lasso selection, floating just above it (or below when there is no room). */
export function SelectionMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const sel = state.selection
  if (!sel) return null
  // Leaves room for the rotate handle above the frame.
  const above = sel.rect.y - MENU_HEIGHT - GAP - 56
  // Below the frame, it also clears the rotate handle when that sits below.
  const below = sel.rect.y + sel.rect.height + GAP + (sel.handleBelow ? 60 : 0)
  const top = above > 72 && !sel.handleBelow ? above : below
  const left = sel.rect.x + sel.rect.width / 2
  return (
    <div
      role="toolbar"
      aria-label={`${sel.count} selected`}
      className="absolute z-10 flex w-max -translate-x-1/2 items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
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
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Color"
            className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
          >
            <span
              className="size-[18px] rounded-full ring-2 ring-white/80"
              style={{ background: sel.color ?? '#3e2d25' }}
            />
            Color
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <ColorPicker
            value={sel.color ?? '#3e2d25'}
            onChange={(color) => editor.recolorSelection(color)}
          />
        </PopoverContent>
      </Popover>
      <MenuButton
        label="Scale"
        pressed={sel.scaling}
        onClick={() => editor.setSelectionScaling(!sel.scaling)}
      >
        <Scaling size={18} />
      </MenuButton>
      <MenuButton label="Duplicate" onClick={() => editor.duplicateSelection()}>
        <CopyPlus size={18} />
      </MenuButton>
      {/* Lucide names these icons by their axis line, the opposite of the action. */}
      <MenuButton
        label="Flip horizontally"
        iconOnly
        onClick={() => editor.flipSelection('horizontal')}
      >
        <FlipVertical2 size={18} />
      </MenuButton>
      <MenuButton label="Flip vertically" iconOnly onClick={() => editor.flipSelection('vertical')}>
        <FlipHorizontal2 size={18} />
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
  iconOnly,
  pressed,
  children,
}: {
  label: string
  onClick: () => void
  /** For on/off options such as Scale. */
  pressed?: boolean
  /** Shows only the icon; the label stays available as the accessible name and tooltip. */
  iconOnly?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={pressed}
      title={iconOnly ? label : undefined}
      className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15 aria-pressed:bg-cream aria-pressed:text-ink"
    >
      {children}
      {iconOnly ? null : label}
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
