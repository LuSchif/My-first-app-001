import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Plus } from '../../design/icons/icons.tsx'
import {
  BroomitIcon,
  ColorPicker,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../design/index.ts'
import type { GlyphName } from '../../design/icons/glyphs.tsx'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import { cn } from '../../lib/cn.ts'
import {
  BroomSettings,
  HighlighterSettings,
  LaserSettings,
  LassoSettings,
  MagicPenSettings,
  PenSettings,
  TapeSettings,
  TextSettings,
} from './Toolbar.tsx'

/**
 * Broome's tool dock, at the top in the middle: four kinds of tools in the first row (write,
 * erase, tools, text), and in the second row what the chosen kind offers: its tools, sizes and
 * colors, and + for everything else about it.
 */
type Kind = 'write' | 'erase' | 'tools' | 'text'

const KINDS: { kind: Kind; label: string; icon: GlyphName; tools: readonly ToolId[] }[] = [
  { kind: 'write', label: 'Write', icon: 'pen', tools: ['pen', 'magic', 'highlighter'] },
  { kind: 'erase', label: 'Eraser', icon: 'eraser', tools: ['broom'] },
  {
    kind: 'tools',
    label: 'Tools',
    icon: 'tools',
    tools: ['lasso', 'magnifier', 'path', 'laser', 'tape', 'eyedropper'],
  },
  { kind: 'text', label: 'Text', icon: 'text', tools: ['text'] },
]

function kindOf(tool: ToolId): Kind {
  return KINDS.find((k) => k.tools.includes(tool))?.kind ?? 'write'
}

/** Line widths offered for each tool, in points. */
const WIDTHS: Partial<Record<ToolId, readonly number[]>> = {
  pen: [1, 2, 3.5],
  magic: [1, 2, 3.5],
  highlighter: [8, 14, 22],
  broom: [8, 16, 32],
}

/** Colors offered before any were used in the notebook. */
const STARTER_COLORS: Partial<Record<ToolId, readonly string[]>> = {
  pen: ['#3e2d25', '#d9483b', '#3d7be0'],
  magic: ['#3e2d25', '#d9483b', '#3d7be0'],
  highlighter: ['#f2cf4a', '#a8d98f', '#f4a9bc'],
  text: ['#1f1d1b', '#d9483b', '#3d7be0'],
  tape: ['#d9b48f', '#9cc9f0', '#f4a9bc'],
}

export function ToolDock({ editor, state }: { editor: Editor; state: EditorState }) {
  const kind = kindOf(state.tool)
  // The tool last used of each kind, so going back to a kind picks it up again.
  const last = useRef<Record<Kind, ToolId>>({
    write: 'pen',
    erase: 'broom',
    tools: 'lasso',
    text: 'text',
  })
  useEffect(() => {
    last.current[kind] = state.tool
  }, [kind, state.tool])
  const { features } = state

  const writeTools: {
    id: string
    label: string
    icon: ReactNode
    on: boolean
    pick: () => void
  }[] = [
    {
      id: 'ballpoint',
      label: 'Ballpoint',
      icon: <BroomitIcon name="pen" size={26} tip={state.pen.color} />,
      on: state.tool === 'pen' && state.pen.nib === 'ballpoint',
      pick: () => {
        editor.setPen({ nib: 'ballpoint' })
        editor.setTool('pen')
      },
    },
    {
      id: 'fountain',
      label: 'Fountain pen',
      icon: <BroomitIcon name="fountain" size={26} tip={state.pen.color} />,
      on: state.tool === 'pen' && state.pen.nib === 'fountain',
      pick: () => {
        editor.setPen({ nib: 'fountain' })
        editor.setTool('pen')
      },
    },
    {
      id: 'highlighter',
      label: 'Highlighter',
      icon: <BroomitIcon name="highlighter" size={26} tip={state.highlighter.color} />,
      on: state.tool === 'highlighter',
      pick: () => editor.setTool('highlighter'),
    },
    ...(features.magicPen
      ? [
          {
            id: 'magic',
            label: 'Magic pen',
            icon: <BroomitIcon name="magic" size={26} tip={state.pen.color} />,
            on: state.tool === 'magic',
            pick: () => editor.setTool('magic'),
          },
        ]
      : []),
  ]

  const toolTools: { tool: ToolId; label: string; icon: ReactNode; lasso?: 'freehand' | 'rect' }[] =
    [
      {
        tool: 'lasso',
        lasso: 'freehand',
        label: 'Lasso',
        icon: <BroomitIcon name="lasso" size={26} />,
      },
      {
        tool: 'lasso',
        lasso: 'rect',
        label: 'Selection',
        icon: <BroomitIcon name="selection" size={26} />,
      },
      ...(features.magnifier
        ? [
            {
              tool: 'magnifier' as const,
              label: 'Magnifier',
              icon: <BroomitIcon name="magnifier" size={26} />,
            },
          ]
        : []),
      ...(features.pathTool
        ? [
            {
              tool: 'path' as const,
              label: 'Anchor tool',
              icon: <BroomitIcon name="anchor" size={26} />,
            },
          ]
        : []),
      ...(features.laser
        ? [
            {
              tool: 'laser' as const,
              label: 'Laser pointer',
              icon: <BroomitIcon name="laser" size={26} />,
            },
          ]
        : []),
      ...(features.tape
        ? [{ tool: 'tape' as const, label: 'Tape', icon: <BroomitIcon name="tape" size={26} /> }]
        : []),
      ...(features.eyedropper
        ? [
            {
              tool: 'eyedropper' as const,
              label: 'Color picker',
              icon: <BroomitIcon name="eyedropper" size={26} />,
            },
          ]
        : []),
    ]

  const settings = settingsFor(state.tool, editor, state)
  const widths = WIDTHS[state.tool]
  const width = currentWidth(state)
  const colorTool = state.tool === 'magic' ? 'magic' : state.tool
  const hasColors = Boolean(STARTER_COLORS[colorTool])

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      className="pointer-events-auto grid max-w-[calc(100vw-24px)] justify-items-center gap-1 rounded-panel glass px-2 pt-1.5 pb-2 shadow-raised ring-1 ring-line"
    >
      <div className="flex w-full items-center justify-around gap-1 px-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            aria-label={k.label}
            aria-pressed={kind === k.kind}
            onClick={() => editor.setTool(kind === k.kind ? state.tool : last.current[k.kind])}
            className="bicon-host grid h-12 w-16 place-items-center rounded-control text-ink-muted hover:bg-hover aria-pressed:text-ink"
          >
            <BroomitIcon name={k.icon} size={30} colored={kind === k.kind} />
          </button>
        ))}
      </div>
      <div className="h-px w-[calc(100%-16px)] bg-line" />
      <div className="flex max-w-full items-center gap-1 overflow-x-auto px-1">
        {kind === 'write'
          ? writeTools.map((t) => (
              <DockButton key={t.id} label={t.label} on={t.on} onClick={t.pick}>
                {t.icon}
              </DockButton>
            ))
          : null}
        {kind === 'erase' ? (
          <>
            <DockText
              label="Precise"
              on={state.broom.mode === 'precise'}
              onClick={() => editor.setBroom({ mode: 'precise' })}
            />
            <DockText
              label="Whole strokes"
              on={state.broom.mode === 'stroke'}
              onClick={() => editor.setBroom({ mode: 'stroke' })}
            />
          </>
        ) : null}
        {kind === 'tools'
          ? toolTools.map((t) => {
              const on = state.tool === t.tool && (!t.lasso || state.lassoMode === t.lasso)
              return (
                <DockButton
                  key={`${t.tool}-${t.lasso ?? ''}`}
                  label={t.label}
                  on={on}
                  onClick={() => {
                    if (t.lasso) editor.setLassoMode(t.lasso)
                    editor.setTool(t.tool)
                  }}
                >
                  {t.icon}
                </DockButton>
              )
            })
          : null}
        {settings ? (
          <MoreButton label={`${toolName(state)} settings`}>{settings}</MoreButton>
        ) : null}
        {widths ? (
          <>
            <Divider />
            {widths.map((w, i) => (
              <button
                key={w}
                type="button"
                aria-label={`${['Thin', 'Medium', 'Thick'][i]} (${w} pt)`}
                aria-pressed={Math.abs(width - w) < 0.01}
                onClick={() => setWidth(editor, state.tool, w)}
                className="grid size-10 place-items-center rounded-full hover:bg-hover aria-pressed:ring-2 aria-pressed:ring-selected"
              >
                <span
                  className="block w-5 rounded-full bg-ink"
                  style={{ height: `${2 + i * 2.5}px` }}
                />
              </button>
            ))}
          </>
        ) : null}
        {hasColors ? (
          <>
            <Divider />
            <DockColors editor={editor} state={state} tool={colorTool} />
          </>
        ) : null}
      </div>
    </div>
  )
}

function toolName(state: EditorState): string {
  switch (state.tool) {
    case 'pen':
      return state.pen.nib === 'fountain' ? 'Fountain pen' : 'Ballpoint'
    case 'magic':
      return 'Magic pen'
    case 'highlighter':
      return 'Highlighter'
    case 'broom':
      return 'Eraser'
    case 'lasso':
      return 'Lasso'
    case 'tape':
      return 'Tape'
    case 'laser':
      return 'Laser pointer'
    case 'text':
      return 'Text'
    default:
      return 'Tool'
  }
}

function settingsFor(tool: ToolId, editor: Editor, state: EditorState): ReactNode {
  switch (tool) {
    case 'pen':
      return <PenSettings editor={editor} state={state} />
    case 'magic':
      return <MagicPenSettings editor={editor} state={state} />
    case 'highlighter':
      return <HighlighterSettings editor={editor} state={state} />
    case 'broom':
      return <BroomSettings editor={editor} state={state} />
    case 'lasso':
      return <LassoSettings editor={editor} state={state} />
    case 'tape':
      return <TapeSettings editor={editor} state={state} />
    case 'laser':
      return <LaserSettings editor={editor} state={state} />
    case 'text':
      return <TextSettings editor={editor} state={state} />
    default:
      return null
  }
}

function currentWidth(state: EditorState): number {
  switch (state.tool) {
    case 'highlighter':
      return state.highlighter.width
    case 'broom':
      return state.broom.size
    default:
      return state.pen.width
  }
}

function setWidth(editor: Editor, tool: ToolId, w: number): void {
  if (tool === 'highlighter') editor.setHighlighter({ width: w })
  else if (tool === 'broom') editor.setBroom({ size: w })
  else editor.setPen({ width: w })
}

function currentColor(state: EditorState): string {
  if (state.tool === 'highlighter') return state.highlighter.color
  if (state.tool === 'tape') return state.tape.color
  if (state.tool === 'text' || state.editingText) return state.textStyle.color
  return state.pen.color
}

function DockButton({
  label,
  on,
  onClick,
  children,
}: {
  label: string
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={onClick}
      className="bicon-host grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-hover aria-pressed:bg-pressed aria-pressed:text-ink"
    >
      {children}
    </button>
  )
}

function DockText({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="h-10 shrink-0 rounded-control px-3 text-sm font-semibold text-ink-muted hover:bg-hover aria-pressed:bg-pressed aria-pressed:text-ink"
    >
      {label}
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-7 w-px shrink-0 bg-line" />
}

/** + for the rest of a tool's settings. */
function MoreButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink ring-1 ring-line-strong hover:bg-hover"
        >
          <Plus size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="grid max-h-[min(40rem,calc(100dvh-8rem))] w-80 gap-5 overflow-y-auto">
        {children}
      </PopoverContent>
    </Popover>
  )
}

const DRAG_PX = 8
/** A dragged color floats above the finger, so the drop point stays visible. */
const LIFT_PX = 44

/**
 * Three colors for the tool in use (the ones used last in this notebook, or a few to start
 * with) and + for any color. Tap one to use it; drag one onto ink, text or paper to color it.
 */
function DockColors({ editor, state, tool }: { editor: Editor; state: EditorState; tool: ToolId }) {
  const current = currentColor(state).toLowerCase()
  const starters = STARTER_COLORS[tool] ?? []
  const recent = state.features.recentColors ? state.recentColors : []
  const colors = [...new Set([...recent, ...starters].map((c) => c.toLowerCase()))].slice(0, 3)
  if (!colors.includes(current)) colors[colors.length - 1] = current
  const drag = useRef<{ id: number; x: number; y: number; color: string; moved: boolean } | null>(
    null,
  )
  const [ghost, setGhost] = useState<{ x: number; y: number; color: string } | null>(null)
  const choose = (color: string) => {
    if (tool === 'magic') editor.setPen({ color })
    else editor.applyColor(color)
  }
  const end = (e: React.PointerEvent, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setGhost(null)
    if (cancelled) editor.endColorPreview()
    else if (d.moved) editor.dropColor(e.clientX, e.clientY - LIFT_PX, d.color)
    else choose(d.color)
  }
  return (
    <>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use color ${color}`}
          aria-pressed={color === current}
          title="Tap to use, drag onto ink, text or paper to color it"
          className="grid size-10 shrink-0 touch-none place-items-center rounded-full"
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
            className={cn(
              'size-8 rounded-full ring-1 ring-line-strong',
              color === current && 'ring-2 ring-selected ring-offset-2 ring-offset-surface-raised',
            )}
            style={{ background: color }}
          />
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="More colors"
            className="grid size-10 shrink-0 place-items-center rounded-full text-ink ring-1 ring-line-strong hover:bg-hover"
          >
            <Plus size={20} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <ColorPicker value={currentColor(state)} onChange={choose} />
        </PopoverContent>
      </Popover>
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
