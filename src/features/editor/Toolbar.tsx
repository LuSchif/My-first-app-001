import {
  Check,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CloudAlert,
  EyeOff,
  Highlighter,
  Lasso,
  Layers,
  LoaderCircle,
  LayoutGrid,
  Lock,
  PenLine,
  PenTool,
  Redo2,
  SquareDashed,
  Type,
  Undo2,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import type { StrokeDash } from '../../engine/model/types.ts'
import { dashPattern } from '../../engine/render/strokes.ts'
import { cn } from '../../lib/cn.ts'
import {
  BroomIcon,
  LaserBroomIcon,
  ColorPicker,
  ColorSwatch,
  Dialog,
  DialogTrigger,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Switch,
} from '../../design/index.ts'
import type { Autosave } from '../../storage/Autosave.ts'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import { FloatingPanel, PanelDivider } from './FloatingPanel.tsx'
import { setTopCorners } from './panelLayout.ts'
import { InsertTools } from './InsertMenu.tsx'
import { useExpanded } from './useExpanded.ts'
import { PagesOverview } from './PagesOverview.tsx'
import { LayersPanel } from './LayersPanel.tsx'
import { RecentColors } from './RecentColors.tsx'
import { PathMenu } from './PathMenu.tsx'
import { PasteButton, PasteMenu, SelectionMenu } from './SelectionMenu.tsx'
import { SuggestionChip } from './SuggestionChip.tsx'
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
  doc,
  onBack,
}: {
  editor: Editor
  autosave: Autosave
  title: string
  doc: NotebookDocument
  onBack: () => void
}) {
  const state = useSyncExternalStore(
    (fn) => editor.subscribe(fn),
    () => editor.state,
  )
  const [panel, setPanel] = useState<ToolId | 'pages' | 'layers' | null>(null)
  const activeLayer = state.layers.find((l) => l.id === state.activeLayerId)
  const [expanded, setExpanded] = useExpanded('broomit.toolbarExpanded')
  const leftCorner = useRef<HTMLDivElement>(null)
  const rightCorner = useRef<HTMLDivElement>(null)

  // A bar at the top keeps clear of the title and of the layer and page buttons.
  useLayoutEffect(() => {
    const left = leftCorner.current
    const right = rightCorner.current
    if (!left || !right) return
    const measure = () => setTopCorners(left.offsetWidth, right.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(left)
    observer.observe(right)
    return () => observer.disconnect()
  }, [])

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
        <div
          ref={leftCorner}
          className={cn(
            'pointer-events-auto flex min-w-0 items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur',
            !expanded && 'pr-4',
          )}
        >
          <IconButton label="All notebooks" icon={<ChevronLeft {...ICON} />} onClick={onBack} />
          {/* With all tools shown, the bars give up words so everything stays on one row. */}
          <span
            className={cn(
              'truncate font-semibold',
              expanded ? 'sr-only' : 'max-w-[16ch] sm:max-w-[24ch]',
            )}
          >
            {title}
          </span>
        </div>

        <FloatingPanel id="tools" label="Tools" defaultDock="top" order={0}>
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
              <TextSettings editor={editor} state={state} />
            </>,
          )}
          {toolButton('path', 'Edit paths', <PenTool {...ICON} />)}
          {expanded ? (
            <>
              {toolButton(
                'laser',
                'Laser pointer',
                <LaserBroomIcon size={22} />,
                <LaserSettings editor={editor} state={state} />,
              )}
              <InsertTools editor={editor} notebookId={doc.notebook.id} />
            </>
          ) : null}
          <IconButton
            label={expanded ? 'Fewer tools' : 'More tools'}
            icon={expanded ? <ChevronsLeft {...ICON} /> : <ChevronsRight {...ICON} />}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          />
          <PanelDivider />
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
        </FloatingPanel>

        <div
          ref={rightCorner}
          className="pointer-events-auto flex items-center gap-1 rounded-panel bg-surface-raised/95 p-1.5 shadow-raised backdrop-blur"
        >
          <SaveStatus autosave={autosave} compact={expanded} />
          <Popover
            open={panel === 'layers'}
            onOpenChange={(open) => setPanel(open ? 'layers' : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Layers, active: ${activeLayer?.name ?? ''}`}
                className="flex h-11 max-w-[14ch] items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-hover"
              >
                <Layers size={18} className="shrink-0" />
                {state.layers.length > 1 ? (
                  <span className="truncate">{activeLayer?.name}</span>
                ) : null}
                {activeLayer && !activeLayer.visible ? (
                  <EyeOff size={14} className="shrink-0 text-danger" />
                ) : activeLayer?.locked ? (
                  <Lock size={14} className="shrink-0 text-danger" />
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <LayersPanel editor={editor} state={state} />
            </PopoverContent>
          </Popover>
          <Dialog open={panel === 'pages'} onOpenChange={(open) => setPanel(open ? 'pages' : null)}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold tabular-nums hover:bg-hover"
              >
                <LayoutGrid size={18} />
                {expanded ? (
                  <span aria-label={`Page ${state.pageIndex + 1} of ${state.pageCount}`}>
                    {state.pageIndex + 1}/{state.pageCount}
                  </span>
                ) : (
                  <>
                    Page {state.pageIndex + 1} of {state.pageCount}
                  </>
                )}
              </button>
            </DialogTrigger>
            {panel === 'pages' ? (
              <PagesOverview
                editor={editor}
                doc={doc}
                currentIndex={state.pageIndex}
                onClose={() => setPanel(null)}
              />
            ) : null}
          </Dialog>
        </div>
      </div>
      {state.editingText ? <FormatBar editor={editor} state={state} /> : null}
      <SelectionMenu editor={editor} state={state} />
      <PathMenu editor={editor} state={state} />
      <RecentColors editor={editor} state={state} />
      <SuggestionChip editor={editor} state={state} />
      <PasteButton editor={editor} state={state} />
      <PasteMenu editor={editor} state={state} />
      {state.notice ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto w-fit max-w-[calc(100%-24px)] rounded-panel bg-ink px-4 py-3 text-sm font-semibold text-ink-inverse shadow-overlay"
        >
          {state.notice}
        </div>
      ) : null}
    </>
  )
}

/** Text formatting while typing, right above the on-screen keyboard. */
function FormatBar({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    // Using the format bar keeps the keyboard open.
    <FloatingPanel
      id="format"
      label="Text format"
      defaultDock="bottom"
      order={1}
      data-keep-keyboard=""
      className="max-w-[calc(100%-24px)] shadow-overlay"
    >
      <TextFormatControls
        editor={editor}
        style={state.textStyle}
        onDone={() => editor.finishText()}
      />
    </FloatingPanel>
  )
}

const LASER_COLORS = [
  ['Red', '#e0533f'],
  ['Caramel', '#d08a4a'],
  ['Green', '#3fae5a'],
  ['Blue', '#3f7fe0'],
  ['Purple', '#9b5de5'],
] as const

function LaserSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Point at things while you present. The trail fades on its own and never changes the page.
      </p>
      <div role="group" aria-label="Laser colors" className="flex flex-wrap">
        {LASER_COLORS.map(([name, color]) => (
          <ColorSwatch
            key={color}
            label={name}
            fill={{ type: 'solid', color }}
            selected={state.laserColor === color}
            onSelect={() => {
              editor.setLaserColor(color)
            }}
          />
        ))}
      </div>
    </>
  )
}

function TextSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  return <TextFormatControls editor={editor} style={state.textStyle} />
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
          onClick={() => {
            editor.setLassoMode(mode)
          }}
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
          hint="Rotate in 45° steps: 0°, 45°, 90°, 135°, 180° …"
          checked={state.snapRotation}
          onChange={(on) => {
            editor.setSnapRotation(on)
          }}
        />
      </div>
    </div>
  )
}

const LINE_STYLES = [
  [null, 'Solid'],
  ['dashed', 'Dashed'],
  ['dotted', 'Dotted'],
] as const

/** The same dash lengths the canvas uses (render/strokes.ts), for previews. */
function dashArray(dash: StrokeDash | null, width: number): string | undefined {
  const pattern = dashPattern({ width, dash: dash ?? undefined })
  return pattern.length ? pattern.join(' ') : undefined
}

function PenSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { pen } = state
  return (
    <>
      <svg
        aria-hidden="true"
        className="h-10 w-full rounded-control bg-paper ring-1 ring-line"
        viewBox="0 0 280 40"
        preserveAspectRatio="none"
      >
        <path
          d="M24 26 C 80 6, 130 34, 180 18 S 240 12, 256 16"
          fill="none"
          stroke={pen.color}
          strokeOpacity={pen.opacity}
          strokeWidth={Math.max(1, pen.width * 1.4)}
          strokeLinecap="round"
          strokeDasharray={dashArray(pen.dash, Math.max(1, pen.width * 1.4))}
        />
      </svg>
      <div role="group" aria-label="Line style" className="grid grid-cols-3 gap-1.5">
        {LINE_STYLES.map(([dash, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={pen.dash === dash}
            onClick={() => {
              editor.setPen({ dash })
            }}
            className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-control px-2 text-xs font-semibold ring-1 ring-line aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink"
          >
            <svg aria-hidden="true" width="44" height="6" viewBox="0 0 44 6">
              <line
                x1="3"
                y1="3"
                x2="41"
                y2="3"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={dashArray(dash, 2.5)}
              />
            </svg>
            {label}
          </button>
        ))}
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
      <div className="border-t border-line pt-2">
        <Switch
          label="Shape and fill suggestions"
          hint="Offer Auto shape for drawn shapes and Auto fill when coloring one in"
          checked={state.suggest}
          onChange={(on) => {
            editor.setSuggest(on)
          }}
        />
      </div>
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
            onSelect={() => {
              editor.setHighlighter({ color })
            }}
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
            onClick={() => {
              editor.setBroom({ mode })
            }}
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

function SaveStatus({ autosave, compact }: { autosave: Autosave; compact: boolean }) {
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
      <span className={cn(compact && 'sr-only')}>{saving ? 'Saving' : 'Saved'}</span>
    </span>
  )
}
