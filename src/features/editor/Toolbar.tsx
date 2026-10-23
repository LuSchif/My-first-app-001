import {
  Check,
  ChevronLeft,
  CloudAlert,
  Copy,
  FilePlus2,
  Highlighter,
  Lasso,
  LoaderCircle,
  PenLine,
  Redo2,
  Trash2,
  SquareDashed,
  Type,
  Undo2,
} from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import { cn } from '../../lib/cn.ts'
import {
  BroomIcon,
  Button,
  ColorPicker,
  ColorSwatch,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Switch,
} from '../../design/index.ts'
import { useVisualViewportBottom } from '../../lib/useVisualViewport.ts'
import type { Autosave } from '../../storage/Autosave.ts'
import { RecentColors } from './RecentColors.tsx'
import { PasteButton, SelectionMenu } from './SelectionMenu.tsx'
import { TextFormatControls } from './TextFormatControls.tsx'

const HIGHLIGHTER_COLORS = [
  ['Yellow', '#f2cf4a'],
  ['Green', '#a8d98f'],
  ['Pink', '#f4a9bc'],
  ['Blue', '#9cc9f0'],
  ['Orange', '#f6b26b'],
  ['Purple', '#c9b3ec'],
  ['Teal', '#8fd6c8'],
  ['Red', '#f19a8e'],
] as const

const ICON = { size: 22, strokeWidth: 1.75 }

export function Toolbar({
  editor,
  autosave,
  title,
  onBack,
}: {
  editor: Editor
  autosave: Autosave
  title: string
  onBack: () => void
}) {
  const state = useSyncExternalStore(
    (fn) => editor.subscribe(fn),
    () => editor.state,
  )
  const [panel, setPanel] = useState<ToolId | 'pages' | null>(null)

  // The first tap selects a tool; tapping the selected tool again opens its settings.
  const toolButton = (tool: ToolId, label: string, icon: ReactNode, settings?: ReactNode) =>
    settings === undefined ? (
      <IconButton
        label={label}
        icon={icon}
        active={state.tool === tool}
        onClick={() => editor.setTool(tool)}
      />
    ) : (
      <Popover open={panel === tool} onOpenChange={(open) => setPanel(open ? tool : null)}>
        <PopoverTrigger asChild>
          <IconButton
            label={label}
            icon={icon}
            active={state.tool === tool}
            onClick={(e) => {
              if (state.tool !== tool) {
                e.preventDefault()
                editor.setTool(tool)
                setPanel(null)
              }
            }}
          />
        </PopoverTrigger>
        <PopoverContent className="grid w-80 gap-5">{settings}</PopoverContent>
      </Popover>
    )

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[calc(10px+env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex min-w-0 items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 pr-4 shadow-raised backdrop-blur">
          <IconButton label="All notebooks" icon={<ChevronLeft {...ICON} />} onClick={onBack} />
          <span className="max-w-[16ch] truncate font-semibold sm:max-w-[24ch]">{title}</span>
        </div>

        <div
          role="toolbar"
          aria-label="Tools"
          className="pointer-events-auto flex items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur"
        >
          {toolButton(
            'lasso',
            state.lassoMode === 'rect' ? 'Rectangle lasso' : 'Lasso',
            state.lassoMode === 'rect' ? <SquareDashed {...ICON} /> : <Lasso {...ICON} />,
            <LassoSettings editor={editor} state={state} />,
          )}
          {toolButton(
            'pen',
            'Pen',
            <PenLine {...ICON} />,
            <PenSettings editor={editor} state={state} />,
          )}
          {toolButton(
            'highlighter',
            'Highlighter',
            <Highlighter {...ICON} />,
            <HighlighterSettings editor={editor} state={state} />,
          )}
          {toolButton(
            'broom',
            'Broom',
            <BroomIcon size={22} />,
            <BroomSettings editor={editor} state={state} />,
          )}
          {toolButton(
            'text',
            'Text',
            <Type {...ICON} />,
            <>
              <p className="text-sm font-semibold">Style for new text</p>
              <TextFormatControls editor={editor} style={state.textStyle} />
            </>,
          )}
          <span className="mx-1 h-7 w-px bg-line" />
          <IconButton
            label="Undo"
            icon={<Undo2 {...ICON} />}
            disabled={!state.canUndo}
            onClick={() => editor.undo()}
          />
          <IconButton
            label="Redo"
            icon={<Redo2 {...ICON} />}
            disabled={!state.canRedo}
            onClick={() => editor.redo()}
          />
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur">
          <SaveStatus autosave={autosave} />
          <Popover
            open={panel === 'pages'}
            onOpenChange={(open) => setPanel(open ? 'pages' : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-11 rounded-control px-3 text-sm font-semibold tabular-nums hover:bg-hover"
              >
                Page {state.pageIndex + 1} of {state.pageCount}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <PageMenu editor={editor} state={state} onDone={() => setPanel(null)} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {state.editingText ? <FormatBar editor={editor} state={state} /> : null}
      <SelectionMenu editor={editor} state={state} />
      <RecentColors editor={editor} state={state} />
      <PasteButton editor={editor} state={state} />
    </>
  )
}

/** Text formatting while typing, right above the on-screen keyboard. */
function FormatBar({ editor, state }: { editor: Editor; state: EditorState }) {
  const bottom = useVisualViewportBottom()
  return (
    <div
      className="pointer-events-auto fixed inset-x-0 z-20 mx-auto w-fit max-w-[calc(100%-24px)] rounded-panel bg-surface-raised/95 p-1.5 shadow-overlay backdrop-blur"
      style={{ top: bottom - 68 - 12 }}
    >
      <TextFormatControls
        editor={editor}
        style={state.textStyle}
        onDone={() => editor.finishText()}
      />
    </div>
  )
}

function LassoSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const modes = [
    ['freehand', 'Freehand', 'Draw a loop around what you want', <Lasso key="f" size={20} />],
    ['rect', 'Rectangle', 'Drag a box over what you want', <SquareDashed key="r" size={20} />],
  ] as const
  return (
    <div role="group" aria-label="Lasso shape" className="grid gap-1.5">
      {modes.map(([mode, label, hint, icon]) => (
        <button
          key={mode}
          type="button"
          aria-pressed={state.lassoMode === mode}
          onClick={() => editor.setLassoMode(mode)}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-left ring-1 ring-line',
            'aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink',
          )}
        >
          {icon}
          <span>
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs opacity-75">{hint}</span>
          </span>
        </button>
      ))}
      <p className="pt-1 text-xs text-ink-muted">
        Touching part of a stroke is enough to select it.
      </p>
      <div className="mt-1 border-t border-line pt-2">
        <Switch
          label="Snap rotation"
          hint="Settle on 15° steps such as 30°, 45°, 90° and 180°"
          checked={state.snapRotation}
          onChange={(on) => editor.setSnapRotation(on)}
        />
      </div>
    </div>
  )
}

function PenSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { pen } = state
  return (
    <>
      <div className="grid h-10 place-items-center rounded-control bg-paper ring-1 ring-line">
        <span
          className="block w-3/4 rounded-full"
          style={{
            background: pen.color,
            opacity: pen.opacity,
            height: Math.max(1, pen.width * 1.4),
          }}
        />
      </div>
      <Slider
        label="Size"
        value={pen.width}
        min={0.5}
        max={10}
        step={0.5}
        onChange={(width) => editor.setPen({ width })}
        format={(v) => `${v} pt`}
      />
      <Slider
        label="Opacity"
        value={Math.round(pen.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => editor.setPen({ opacity: v / 100 })}
        format={(v) => `${v}%`}
      />
      <ColorPicker value={pen.color} onChange={(color) => editor.setPen({ color })} />
    </>
  )
}

function HighlighterSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { highlighter } = state
  return (
    <>
      <Slider
        label="Size"
        value={highlighter.width}
        min={6}
        max={40}
        onChange={(width) => editor.setHighlighter({ width })}
        format={(v) => `${v} pt`}
      />
      <div role="group" aria-label="Highlighter colors" className="flex flex-wrap">
        {HIGHLIGHTER_COLORS.map(([name, color]) => (
          <ColorSwatch
            key={color}
            label={name}
            fill={{ type: 'solid', color }}
            selected={highlighter.color === color}
            onSelect={() => editor.setHighlighter({ color })}
          />
        ))}
      </div>
    </>
  )
}

function BroomSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { broom } = state
  const modes = [
    ['precise', 'Precise', 'Sweeps away only what it touches'],
    ['stroke', 'Whole strokes', 'Removes every stroke it touches'],
  ] as const
  return (
    <>
      <Slider
        label="Broom size"
        value={broom.size}
        min={4}
        max={80}
        onChange={(size) => editor.setBroom({ size })}
        format={(v) => `${v} pt`}
      />
      <div role="group" aria-label="Broom mode" className="grid gap-1.5">
        {modes.map(([mode, label, hint]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={broom.mode === mode}
            onClick={() => editor.setBroom({ mode })}
            className={cn(
              'flex min-h-11 items-center justify-between gap-3 rounded-control px-3 py-2 text-left ring-1 ring-line',
              'aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink',
            )}
          >
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-75">{hint}</span>
            </span>
            {broom.mode === mode ? <Check size={18} /> : null}
          </button>
        ))}
      </div>
    </>
  )
}

function PageMenu({
  editor,
  state,
  onDone,
}: {
  editor: Editor
  state: EditorState
  onDone: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const only = state.pageCount <= 1
  return (
    <div className="grid gap-1">
      <Button
        variant="ghost"
        className="justify-start"
        icon={<FilePlus2 size={18} />}
        onClick={() => {
          editor.addPageAfterCurrent()
          onDone()
        }}
      >
        Add page after this one
      </Button>
      <Button
        variant="ghost"
        className="justify-start"
        icon={<Copy size={18} />}
        onClick={() => {
          editor.duplicateCurrentPage()
          onDone()
        }}
      >
        Duplicate page
      </Button>
      {confirmDelete ? (
        <Button
          variant="danger"
          className="justify-start"
          icon={<Trash2 size={18} />}
          onClick={() => {
            editor.deleteCurrentPage()
            onDone()
          }}
        >
          Delete page {state.pageIndex + 1}
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="justify-start text-danger"
          icon={<Trash2 size={18} />}
          disabled={only}
          onClick={() => setConfirmDelete(true)}
        >
          Delete page…
        </Button>
      )}
      {only ? (
        <p className="px-3 pt-1 text-xs text-ink-muted">A notebook keeps at least one page.</p>
      ) : null}
    </div>
  )
}

function SaveStatus({ autosave }: { autosave: Autosave }) {
  const status = useSyncExternalStore(
    (fn) => autosave.subscribe(fn),
    () => autosave.status,
  )
  if (status === 'error') {
    return (
      <span
        className="flex items-center gap-1.5 px-2 text-xs font-semibold text-danger"
        role="status"
      >
        <CloudAlert size={16} /> Not saved, retrying
      </span>
    )
  }
  const saving = status === 'saving' || status === 'pending'
  return (
    <span className="flex items-center gap-1.5 px-2 text-xs text-ink-muted" role="status">
      {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
      {saving ? 'Saving' : 'Saved'}
    </span>
  )
}
