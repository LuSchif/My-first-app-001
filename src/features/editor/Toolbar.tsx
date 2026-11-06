import { MAX_STABILIZATION } from '../../engine/input/StrokeSampler.ts'
import {
  Check,
  ArrowLeft,
  CloudAlert,
  EyeOff,
  Lock,
  GraduationCap,
  Play,
  Redo2,
  Undo2,
} from '../../design/icons/icons.tsx'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import type { StrokeDash } from '../../engine/model/types.ts'
import { dashPattern } from '../../engine/render/strokes.ts'
import { cn } from '../../lib/cn.ts'
import {
  BroomitIcon,
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
import { FloatingPanel } from './FloatingPanel.tsx'
import { setBarArea } from './panelLayout.ts'
import { PagesOverview } from './PagesOverview.tsx'
import { LayersPanel } from './LayersPanel.tsx'
import { ControlCenter } from './ControlCenter.tsx'
import { InspectCard } from './InspectCard.tsx'
import { NewPageMenu, PullForPage } from './NewPage.tsx'
import { PathMenu } from './PathMenu.tsx'
import { PenPreview } from './PenPreview.tsx'
import { PasteButton, SelectionMenu } from './SelectionMenu.tsx'
import { ToolWheel } from './ToolWheel.tsx'
import { ToolDock } from './ToolDock.tsx'
import { RecentColors } from './RecentColors.tsx'
import { SuggestionChip } from './SuggestionChip.tsx'
import { GraphOfferChip } from './GraphEditor.tsx'
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
  onPresent,
  insertOpen,
  onToggleInsert,
  addonsOpen,
  addonsOn,
  onToggleAddons,
}: {
  editor: Editor
  autosave: Autosave
  title: string
  doc: NotebookDocument
  onBack: () => void
  /** Presentations: starts the slide show; flashcards: starts studying. */
  onPresent?: () => void
  /** The panel of things to add (shapes, tables, stickers, photos, pages) is open. */
  insertOpen: boolean
  onToggleInsert: () => void
  /** The addons bar is open, and how many addons are on. */
  addonsOpen: boolean
  addonsOn: number
  onToggleAddons: () => void
}) {
  const state = useSyncExternalStore(
    (fn) => editor.subscribe(fn),
    () => editor.state,
  )
  const [panel, setPanel] = useState<ToolId | 'pages' | 'layers' | 'control' | null>(null)
  const unit = editor.kind === 'presentation' ? 'Slide' : 'Page'
  // A deck counts cards, each with a front and a back.
  const place =
    editor.kind === 'deck'
      ? `Card ${Math.floor(state.pageIndex / 2) + 1} · ${state.pageIndex % 2 ? 'Back' : 'Front'}`
      : `${unit} ${state.pageIndex + 1} of ${state.pageCount}`
  const activeLayer = state.layers.find((l) => l.id === state.activeLayerId)
  // The notebook's name shows at the top of its pages.
  useEffect(() => editor.setPageTitle(title), [editor, title])
  const leftCorner = useRef<HTMLDivElement>(null)
  const rightCorner = useRef<HTMLDivElement>(null)

  // Bars keep to the page area (beside the insert panel) and clear of the top corner groups.
  useLayoutEffect(() => {
    const left = leftCorner.current
    const right = rightCorner.current
    const row = left?.parentElement
    if (!left || !right || !row) return
    const measure = () => {
      const r = row.getBoundingClientRect()
      setBarArea({
        areaLeft: r.left,
        areaRight: r.right,
        leftEnd: left.getBoundingClientRect().right,
        rightStart: right.getBoundingClientRect().left,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(left)
    observer.observe(right)
    observer.observe(row)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 px-[max(12px,env(safe-area-inset-left))] pt-[calc(10px+env(safe-area-inset-top))]">
        <div ref={leftCorner} className="pointer-events-auto flex items-center gap-2">
          {/* Hidden while the panel is open, so closing the panel never closes the notebook. */}
          {insertOpen ? null : (
            <CornerButton label="All notebooks" onClick={onBack}>
              <ArrowLeft size={24} strokeWidth={1.8} />
            </CornerButton>
          )}
          <CornerButton
            label={insertOpen ? 'Close shapes, stickers and more' : 'Shapes, stickers and more'}
            active={insertOpen}
            onClick={onToggleInsert}
          >
            <BroomitIcon name="shapes" size={26} colored={insertOpen} />
          </CornerButton>
        </div>

        <ToolDock editor={editor} state={state} />

        <div
          ref={rightCorner}
          className="pointer-events-auto ml-auto flex items-center gap-0.5 rounded-panel glass p-1.5 shadow-raised ring-1 ring-line"
        >
          <SaveProblem autosave={autosave} />
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
          <span aria-hidden="true" className="mx-1 h-7 w-px bg-line" />
          {onPresent ? (
            <button
              type="button"
              onClick={onPresent}
              className="flex h-11 items-center gap-1.5 rounded-control bg-accent px-3 text-sm font-semibold text-on-accent hover:opacity-90"
            >
              {editor.kind === 'deck' ? (
                <>
                  <GraduationCap size={16} />
                  Study
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  Present
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={addonsOpen ? 'Close addons' : `Addons, ${addonsOn} on`}
            aria-expanded={addonsOpen}
            onClick={onToggleAddons}
            className={cn(
              'bicon-host flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold tabular-nums hover:bg-hover',
              addonsOpen && 'bg-hover',
            )}
            aria-pressed={addonsOpen}
          >
            <BroomitIcon name="addons" size={24} colored={addonsOpen} />
            {addonsOn ? <span>{addonsOn}</span> : null}
          </button>
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
                <BroomitIcon name="layers" size={24} className="shrink-0" />
                {activeLayer && !activeLayer.visible ? (
                  <EyeOff size={14} className="shrink-0 text-danger" />
                ) : activeLayer?.locked ? (
                  <Lock size={14} className="shrink-0 text-danger" />
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent movable="layers" align="end" className="w-80">
              <LayersPanel editor={editor} state={state} />
            </PopoverContent>
          </Popover>
          <Dialog open={panel === 'pages'} onOpenChange={(open) => setPanel(open ? 'pages' : null)}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={`Pages, ${place}`}
                className="grid size-11 place-items-center rounded-control hover:bg-hover"
              >
                <BroomitIcon name="pages" size={24} />
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
          <Popover
            open={panel === 'control'}
            onOpenChange={(open) => setPanel(open ? 'control' : null)}
          >
            <PopoverTrigger asChild>
              <IconButton label="Control center" icon={<BroomitIcon name="settings" size={24} />} />
            </PopoverTrigger>
            <PopoverContent
              movable="control"
              align="end"
              className="max-h-[min(40rem,calc(100dvh-7rem))] w-80 overflow-y-auto"
            >
              <ControlCenter editor={editor} state={state} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {state.editingText ? <FormatBar editor={editor} state={state} /> : null}
      <SelectionMenu editor={editor} state={state} />
      <PathMenu editor={editor} state={state} />
      <RecentColors editor={editor} state={state} />
      <SuggestionChip editor={editor} state={state} />
      <GraphOfferChip editor={editor} state={state} />
      <InspectCard editor={editor} state={state} />
      <PullForPage state={state} />
      <NewPageMenu editor={editor} state={state} />
      <PasteButton editor={editor} state={state} />
      {state.wheel ? (
        <ToolWheel
          key={`${state.wheel.x},${state.wheel.y}`}
          editor={editor}
          state={state}
          onPick={() => {}}
        />
      ) : null}
      {state.notice ? (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-20 mx-auto w-fit max-w-[calc(100%-24px)] rounded-panel bg-surface-raised ring-1 ring-line px-4 py-3 text-sm font-semibold text-ink shadow-overlay"
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

const TAPE_COLORS = [
  ['Caramel', '#d9b48f'],
  ['Sand', '#e8dcc6'],
  ['Mint', '#a8d5c2'],
  ['Sky', '#a9c8ec'],
  ['Rose', '#efb3bd'],
  ['Butter', '#f1d98a'],
  ['Lilac', '#c9b8e6'],
  ['Cocoa', '#8a6a55'],
] as const

export function TapeSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Drag across writing to cover it. Double tap the tape with a finger to reveal what is below,
        and again to cover it.
      </p>
      <Slider
        label="Width"
        value={state.tape.width}
        min={8}
        max={60}
        onChange={(width) => editor.setTape({ width })}
        format={(v) => `${v} pt`}
      />
      <div role="group" aria-label="Tape colors" className="flex flex-wrap">
        {TAPE_COLORS.map(([name, color]) => (
          <ColorSwatch
            key={color}
            label={name}
            fill={{ type: 'solid', color }}
            selected={state.tape.color === color}
            onSelect={() => {
              editor.setTape({ color })
            }}
          />
        ))}
      </div>
    </>
  )
}

const LASER_COLORS = [
  ['Red', '#e0533f'],
  ['Caramel', '#d08a4a'],
  ['Green', '#3fae5a'],
  ['Blue', '#3f7fe0'],
  ['Purple', '#9b5de5'],
] as const

export function LaserSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Point at things while you present. What you draw stays for a second after you stop, then
        fades. It never changes the page.
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

export function TextSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    <>
      <TextFormatControls editor={editor} style={state.textStyle} />
      <div className="border-t border-line pt-2">
        <Switch
          label="Auto align"
          hint="On ruled paper, new text sits on the lines"
          checked={state.features.textAutoAlign}
          onChange={(on) => {
            editor.setFeatures({ textAutoAlign: on })
          }}
        />
      </div>
    </>
  )
}

export function LassoSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const modes = [
    [
      'freehand',
      'Freehand',
      'Draw a loop around what you want',
      <BroomitIcon key="f" name="lasso" size={22} />,
    ],
    [
      'rect',
      'Rectangle',
      'Drag a box over what you want',
      <BroomitIcon key="r" name="selection" size={22} />,
    ],
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
            'aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:ring-accent',
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

/** The pen's own settings (its strokes have theirs, see StrokeSettings). */
export function PenSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { pen } = state
  return (
    <>
      <Slider
        label="Stabilization"
        value={Math.round(state.stabilization * 100)}
        min={0}
        max={MAX_STABILIZATION * 100}
        step={5}
        onChange={(v) => editor.setStabilization(v / 100)}
        format={(v) => (v === 0 ? 'Off' : `${v}%`)}
      />
      <Slider
        label="Opacity"
        value={Math.round(pen.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => editor.setPen({ opacity: v / 100 })}
        format={(v) => `${v}%`}
      />
    </>
  )
}

/**
 * The stroke of the pen in use, opened from the line widths in the dock: its size, preview and
 * line style (solid, dashed, dotted), and for the fountain pen how strongly pressure widens it.
 */
export function StrokeSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { pen } = state
  return (
    <>
      <PenPreview
        color={pen.color}
        width={pen.width}
        opacity={pen.opacity}
        dash={pen.dash}
        fountain={pen.nib === 'fountain'}
      />
      <Slider
        label="Size"
        value={pen.width}
        min={0.3}
        max={12}
        step={0.05}
        onChange={(width) => editor.setPen({ width: Math.round(width * 100) / 100 })}
        format={(v) => `${v.toFixed(1)} pt`}
      />
      {pen.nib === 'fountain' ? (
        <Slider
          label="Pressure sensitivity"
          value={Math.round(pen.sensitivity * 100)}
          min={0}
          max={100}
          step={5}
          onChange={(v) => editor.setPen({ sensitivity: v / 100 })}
          format={(v) => (v === 0 ? 'Off' : `${v}%`)}
        />
      ) : (
        <div role="group" aria-label="Line style" className="grid grid-cols-3 gap-1.5">
          {LINE_STYLES.map(([dash, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={pen.dash === dash}
              onClick={() => {
                editor.setPen({ dash })
              }}
              className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-control px-2 text-xs font-semibold ring-1 ring-line aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:ring-accent"
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
      )}
    </>
  )
}

/** The magic pen shares the pen's color, size and opacity. */
export function MagicPenSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { pen } = state
  return (
    <>
      <p className="text-sm text-ink-muted">
        Lines and curves come out smooth, arrows and graph axes clean, shapes neat, and coloring in
        a shape fills it.
      </p>
      <PenPreview
        color={pen.color}
        width={pen.width}
        opacity={pen.opacity}
        dash={null}
        fountain={false}
      />
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

export function HighlighterSettings({ editor, state }: { editor: Editor; state: EditorState }) {
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

export function BroomSettings({ editor, state }: { editor: Editor; state: EditorState }) {
  const { broom } = state
  const modes = [
    ['precise', 'Precise', 'Erases only what it touches'],
    ['stroke', 'Whole strokes', 'Removes every stroke it touches'],
  ] as const
  return (
    <>
      <Slider
        label="Eraser size"
        value={broom.size}
        min={4}
        max={80}
        onChange={(size) => editor.setBroom({ size })}
        format={(v) => `${v} pt`}
      />
      <div role="group" aria-label="Eraser mode" className="grid gap-1.5">
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
              'aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:ring-accent',
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

/**
 * Saving happens by itself and is not shown; only a failed save is, so nothing is lost
 * unnoticed.
 */
function SaveProblem({ autosave }: { autosave: Autosave }) {
  const status = useSyncExternalStore(
    (fn) => autosave.subscribe(fn),
    () => autosave.status,
  )
  if (status !== 'error') return null
  return (
    <span
      className="flex items-center gap-1.5 px-2 text-xs font-semibold text-danger"
      role="status"
    >
      <CloudAlert size={16} /> Not saved, retrying
    </span>
  )
}

/** A square button of its own in a top corner (back, shapes). */
function CornerButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className="bicon-host grid size-14 place-items-center rounded-panel glass text-ink shadow-raised ring-1 ring-line hover:bg-hover aria-pressed:bg-pressed"
    >
      {children}
    </button>
  )
}
