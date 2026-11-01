import { BroomitIcon } from '../../design/index.ts'
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  Scaling,
  Grid3x3,
  ChartSpline,
  Crop,
  Ellipsis,
  Scissors,
  Sparkles,
  SquareRoundCorner,
  TextCursorInput,
  Trash2,
} from 'lucide-react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import {
  Button,
  ColorPicker,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Slider,
  Switch,
} from '../../design/index.ts'
import { CHART_KINDS, chartFromData } from '../../engine/model/chart.ts'
import { newId } from '../../engine/model/ids.ts'
import {
  addColumn,
  addRow,
  fitToPage,
  hasChartData,
  removeColumn,
  removeRow,
  tableChartData,
} from '../../engine/model/table.ts'
import { CHART_ICONS } from './chartIcons.tsx'
import { Stepper } from './Stepper.tsx'
import {
  type ChartKind,
  type ChartObject,
  type GradientPaint,
  type GraphObject,
  type ImageObject,
  type Outline,
  type TableObject,
} from '../../engine/model/types.ts'
import { fillToCss } from '../../engine/model/fill.ts'
import { cn } from '../../lib/cn.ts'
import { FillEditor } from '../folders/FillEditor.tsx'
import { ChartEditor } from './ChartEditor.tsx'
import { GraphEditor } from './GraphEditor.tsx'
import { PictureEditor } from './PictureEditor.tsx'
import { TableEditor } from './TableEditor.tsx'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { AnimationControls } from '../presentation/AnimationControls.tsx'

const GAP = 14
/** Space kept free at the screen edges and for the toolbar at the top. */
const EDGE = 12
const TOP_SAFE = 72

const pill =
  'flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold whitespace-nowrap hover:bg-white/10 active:bg-white/15'

/** In the bar, in this order; everything else is behind the three dots. */
const PRIMARY = ['delete', 'duplicate', 'copy', 'scale', 'edit']
/** The order of the menu behind the three dots. */
const SECONDARY = [
  'cut',
  'flip-h',
  'flip-v',
  'color',
  'outline',
  'layer',
  'rows',
  'chart',
  'animate',
]

/**
 * Actions for the lasso selection, floating above it (or below when there is no room). The bar
 * holds what is used most (delete, duplicate, copy, scale, and editing a table, chart, graph or
 * text); the three dots open a menu with the rest. It always stays fully on screen.
 */
export function SelectionMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const sel = state.selection
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 56, screenW: 0, screenH: 0 })
  const [more, setMore] = useState(false)
  const open = sel !== null
  const selectionKey = sel ? `${sel.count}-${sel.boxKind ?? ''}-${sel.textId ?? ''}` : ''
  const [shownFor, setShownFor] = useState(selectionKey)
  // A new selection starts with the menu closed.
  if (shownFor !== selectionKey) {
    setShownFor(selectionKey)
    setMore(false)
  }

  // The menu's own size and the space it lives in, to keep it fully on screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const parent = el.offsetParent as HTMLElement | null
      setSize({
        width: el.offsetWidth,
        height: el.offsetHeight,
        screenW: parent?.clientWidth ?? window.innerWidth,
        screenH: parent?.clientHeight ?? window.innerHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [open])

  if (!sel) return null
  const { primary, secondary } = split(menuItems(editor, state, sel))

  // Above the frame (leaving room for the rotate handle), else below it; then kept on screen.
  const screenW = size.screenW || window.innerWidth
  const screenH = size.screenH || window.innerHeight
  const above = sel.rect.y - size.height - GAP - 56
  const below = sel.rect.y + sel.rect.height + GAP + (sel.handleBelow ? 60 : 0)
  let top = above > TOP_SAFE && !sel.handleBelow ? above : below
  top = Math.max(TOP_SAFE, Math.min(screenH - size.height - EDGE, top))
  const half = size.width / 2
  const center = sel.rect.x + sel.rect.width / 2
  const left = Math.max(EDGE + half, Math.min(screenW - EDGE - half, center))
  // The menu opens downwards when there is room below the bar, else upwards.
  const menuUp = top + size.height + 360 > screenH

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={`${sel.count} selected`}
      className="absolute z-10 flex w-max max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
      style={{ top, left }}
    >
      {primary.map((item) => (
        <Fragment key={item.key}>{item.node}</Fragment>
      ))}
      {secondary.length ? (
        <>
          <span aria-hidden="true" className="mx-0.5 h-7 w-px bg-white/20" />
          <MenuButton label="More actions" iconOnly pressed={more} onClick={() => setMore(!more)}>
            <Ellipsis size={18} />
          </MenuButton>
          {more ? (
            <div
              role="menu"
              aria-label="More actions"
              className={cn(
                'absolute right-0 grid min-w-56 animate-pop-in gap-0.5 rounded-panel bg-ink p-1 shadow-overlay [&_button]:w-full [&_button]:justify-start',
                menuUp ? 'bottom-full mb-2' : 'top-full mt-2',
              )}
            >
              {secondary.map((item) => (
                <Fragment key={item.key}>{item.node}</Fragment>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

interface MenuItem {
  key: string
  node: React.ReactNode
}

function split(items: MenuItem[]): { primary: MenuItem[]; secondary: MenuItem[] } {
  const rank = (list: string[], item: MenuItem) => {
    const i = list.indexOf(item.key)
    return i < 0 ? list.length : i
  }
  const primary = items
    .filter((i) => PRIMARY.includes(i.key))
    .sort((a, b) => rank(PRIMARY, a) - rank(PRIMARY, b))
  const secondary = items
    .filter((i) => !PRIMARY.includes(i.key))
    .sort((a, b) => rank(SECONDARY, a) - rank(SECONDARY, b))
  return { primary, secondary }
}

/** Every action that fits the selection; `split` sorts them into the bar and the menu. */
function menuItems(
  editor: Editor,
  state: EditorState,
  sel: NonNullable<EditorState['selection']>,
): MenuItem[] {
  const items: MenuItem[] = []
  const table = sel.boxKind === 'table' ? editor.selectedObject() : null
  const chart = sel.boxKind === 'chart' ? editor.selectedObject() : null
  const graph = sel.boxKind === 'graph' ? editor.selectedObject() : null
  const picture = sel.boxKind === 'image' ? editor.selectedObject() : null

  if (sel.textId) {
    items.push({
      key: 'edit',
      node: (
        <MenuButton label="Edit text" onClick={() => editor.editSelectedText()}>
          <TextCursorInput size={18} />
        </MenuButton>
      ),
    })
  }
  if (table?.type === 'table') {
    items.push({ key: 'edit', node: <EditTableButton editor={editor} table={table} /> })
  }
  if (chart?.type === 'chart') {
    items.push({ key: 'edit', node: <EditChartButton editor={editor} chart={chart} /> })
  }
  if (picture?.type === 'image' && !picture.sticker) {
    items.push({ key: 'edit', node: <EditPictureButton editor={editor} image={picture} /> })
  }
  if (graph?.type === 'graph') {
    items.push({ key: 'edit', node: <EditGraphButton editor={editor} graph={graph} /> })
  }
  items.push({
    key: 'copy',
    node: (
      <MenuButton label="Copy" onClick={() => editor.copySelection()}>
        <Copy size={18} />
      </MenuButton>
    ),
  })
  if (editor.kind === 'presentation') {
    items.push({
      key: 'animate',
      node: (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-pressed={sel.animation !== null} className={pill}>
              <Sparkles size={18} />
              Animate
            </button>
          </PopoverTrigger>
          <PopoverContent movable="selection-animate" className="grid w-80 gap-4">
            <AnimationControls
              editor={editor}
              animation={sel.animation}
              place={sel.animationPlace}
            />
          </PopoverContent>
        </Popover>
      ),
    })
  }
  // Charts and pictures keep their own colors.
  if (sel.boxKind !== 'chart' && sel.boxKind !== 'image') {
    items.push({
      key: 'color',
      node: (
        // Closing the menu records what was previewed in it as one undo step.
        <Popover onOpenChange={(open) => !open && editor.commitSelectionEdit('Color')}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Color" className={pill}>
              <span
                className="size-[18px] rounded-full ring-2 ring-white/80"
                style={{
                  background: sel.gradient ? fillToCss(sel.gradient) : (sel.color ?? '#3e2d25'),
                }}
              />
              Color
            </button>
          </PopoverTrigger>
          <PopoverContent movable="selection-color" className="w-80">
            <SelectionColor
              editor={editor}
              color={sel.color ?? '#3e2d25'}
              gradient={sel.canGradient ? sel.gradient : undefined}
            />
          </PopoverContent>
        </Popover>
      ),
    })
  }
  items.push({
    key: 'duplicate',
    node: (
      <MenuButton label="Duplicate" onClick={() => editor.duplicateSelection()}>
        <CopyPlus size={18} />
      </MenuButton>
    ),
  })
  items.push({
    key: 'delete',
    node: (
      <MenuButton label="Delete" onClick={() => editor.deleteSelection()}>
        <Trash2 size={18} />
      </MenuButton>
    ),
  })
  items.push({
    key: 'cut',
    node: (
      <MenuButton label="Cut" onClick={() => editor.cutSelection()}>
        <Scissors size={18} />
      </MenuButton>
    ),
  })
  if (table?.type === 'table') {
    items.push({ key: 'rows', node: <RowsAndColumns editor={editor} table={table} /> })
    if (hasChartData(table)) {
      items.push({ key: 'chart', node: <MakeChart editor={editor} table={table} /> })
    }
  }
  items.push({
    key: 'outline',
    node: (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={pill}>
            <SquareRoundCorner size={18} />
            Outline
          </button>
        </PopoverTrigger>
        <PopoverContent movable="selection-outline" className="grid w-80 gap-4">
          <OutlineControls editor={editor} outline={sel.outline} />
        </PopoverContent>
      </Popover>
    ),
  })
  if (state.layers.length > 1) {
    items.push({
      key: 'layer',
      node: (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={pill}>
              <BroomitIcon name="layers" size={20} />
              Layer
            </button>
          </PopoverTrigger>
          <PopoverContent movable="selection-layer" className="grid w-64 gap-1">
            <p className="px-1 pb-1 text-sm font-semibold">Move to layer</p>
            {[...state.layers].reverse().map((layer) => (
              <PopoverClose key={layer.id} asChild>
                <Button
                  variant={layer.id === state.activeLayerId ? 'primary' : 'ghost'}
                  className="justify-start"
                  disabled={layer.id === state.activeLayerId || layer.locked}
                  onClick={() => editor.moveSelectionToLayer(layer.id)}
                >
                  <span className="truncate">{layer.name}</span>
                  {layer.locked ? <span className="text-xs font-normal">(locked)</span> : null}
                </Button>
              </PopoverClose>
            ))}
          </PopoverContent>
        </Popover>
      ),
    })
  }
  items.push({
    key: 'scale',
    node: (
      <MenuButton
        label="Scale"
        pressed={sel.scaling}
        onClick={() => editor.setSelectionScaling(!sel.scaling)}
      >
        <Scaling size={18} />
      </MenuButton>
    ),
  })
  // Tables, charts and graphs are not mirrored: a mirrored one no longer reads. Lucide names
  // these icons by their axis line.
  if (sel.boxKind !== 'table' && sel.boxKind !== 'graph' && sel.boxKind !== 'chart') {
    items.push({
      key: 'flip-h',
      node: (
        <MenuButton label="Mirror left to right" onClick={() => editor.flipSelection('horizontal')}>
          <FlipVertical2 size={18} />
        </MenuButton>
      ),
    })
    items.push({
      key: 'flip-v',
      node: (
        <MenuButton label="Mirror top to bottom" onClick={() => editor.flipSelection('vertical')}>
          <FlipHorizontal2 size={18} />
        </MenuButton>
      ),
    })
  }
  return items
}

function EditPictureButton({ editor, image }: { editor: Editor; image: ImageObject }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <MenuButton label="Crop & caption" onClick={() => setEditing(true)}>
        <Crop size={18} />
      </MenuButton>
      <PictureEditor editor={editor} image={image} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function EditGraphButton({ editor, graph }: { editor: Editor; graph: GraphObject }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <MenuButton label="Edit graph" onClick={() => setEditing(true)}>
        <ChartSpline size={18} />
      </MenuButton>
      <GraphEditor editor={editor} graph={graph} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function EditTableButton({ editor, table }: { editor: Editor; table: TableObject }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <MenuButton label="Edit table" onClick={() => setEditing(true)}>
        <BroomitIcon name="table" size={20} />
      </MenuButton>
      <TableEditor editor={editor} table={table} open={editing} onOpenChange={setEditing} />
    </>
  )
}

function EditChartButton({ editor, chart }: { editor: Editor; chart: ChartObject }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <MenuButton label="Edit chart" onClick={() => setEditing(true)}>
        <BroomitIcon name="chart" size={20} />
      </MenuButton>
      <ChartEditor editor={editor} chart={chart} open={editing} onOpenChange={setEditing} />
    </>
  )
}

/** Growing or shrinking a table, with the spacing it already has. */
function RowsAndColumns({ editor, table }: { editor: Editor; table: TableObject }) {
  // A table that grows past the page edge shrinks its columns or rows to fit the page.
  const resize = (next: TableObject, label: string) =>
    editor.updateSelectedObject(
      fitToPage(next, editor.pageSize.width, editor.pageSize.height),
      label,
    )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={pill}>
          <Grid3x3 size={18} />
          Rows &amp; columns
        </button>
      </PopoverTrigger>
      <PopoverContent movable="selection-rows-columns" className="grid w-72 gap-3">
        <Stepper
          label="Columns"
          value={table.columns.length}
          min={1}
          max={20}
          onChange={(n) =>
            resize(
              n > table.columns.length ? addColumn(table) : removeColumn(table, n),
              n > table.columns.length ? 'Add column' : 'Remove column',
            )
          }
        />
        <Stepper
          label="Rows"
          value={table.rows.length}
          min={1}
          max={60}
          onChange={(n) =>
            resize(
              n > table.rows.length ? addRow(table) : removeRow(table, n),
              n > table.rows.length ? 'Add row' : 'Remove row',
            )
          }
        />
        <p className="text-xs text-ink-muted">
          A new column is added on the right, a new row at the bottom, each as wide or tall as the
          last one. Removing takes the last one away.
        </p>
      </PopoverContent>
    </Popover>
  )
}

/** Shows the numbers of a table as a chart, placed next to it. */
function MakeChart({ editor, table }: { editor: Editor; table: TableObject }) {
  const make = (kind: ChartKind) => {
    const data = tableChartData(table)
    const width = kind === 'pie' || kind === 'donut' ? 260 : 340
    const height = 240
    // Right of the table when there is room, below it otherwise.
    const right = table.x + table.width + 16
    const at =
      right + width <= editor.pageSize.width
        ? { x: right, y: table.y }
        : { x: table.x, y: table.y + table.height + 16 }
    editor.insertBox(
      (frame, layerId) => ({
        ...chartFromData(newId(), layerId, frame, kind, data),
        // Its values follow the table from now on.
        sourceTableId: table.id,
      }),
      width,
      height,
      at,
    )
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
        >
          <BroomitIcon name="chart" size={20} />
          Make chart
        </button>
      </PopoverTrigger>
      <PopoverContent movable="selection-make-chart" className="grid w-72 gap-3">
        <p className="text-sm font-semibold">Show this table as a chart</p>
        <div className="grid grid-cols-2 gap-2">
          {CHART_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onClick={() => make(kind)}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-control text-sm font-semibold ring-1 ring-line hover:bg-hover"
            >
              {CHART_ICONS[kind]}
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          The first column names the categories; every column with numbers becomes a series.
        </p>
      </PopoverContent>
    </Popover>
  )
}

const OUTLINE_POSITIONS = [
  ['outside', 'Outside'],
  ['center', 'Center'],
  ['inside', 'Inside'],
] as const

const DEFAULT_OUTLINE: Outline = { color: '#3e2d25', width: 2 }

/** Turns the contour around the selection on or off, and sets its thickness and color. */
function OutlineControls({ editor, outline }: { editor: Editor; outline: Outline | null }) {
  const current = outline ?? DEFAULT_OUTLINE
  return (
    <>
      <Switch
        label="Outline"
        hint="A contour around the selected shapes, lines or text"
        checked={outline !== null}
        onChange={(on) => editor.setSelectionOutline(on ? current : null)}
      />
      {outline ? (
        <>
          <div role="group" aria-label="Outline position" className="grid grid-cols-3 gap-1.5">
            {OUTLINE_POSITIONS.map(([position, label]) => (
              <button
                key={position}
                type="button"
                aria-pressed={(outline.position ?? 'outside') === position}
                onClick={() => editor.setSelectionOutline({ ...outline, position })}
                className="min-h-11 rounded-control text-sm font-semibold ring-1 ring-line aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:ring-ink"
              >
                {label}
              </button>
            ))}
          </div>
          {/* Changes show live while dragging and become one undo step on release. */}
          <Slider
            label="Thickness"
            value={Math.round(outline.width * 2) / 2}
            min={0.5}
            max={12}
            step={0.5}
            onChange={(width) => editor.setSelectionOutline({ ...outline, width }, false)}
            onCommit={() => editor.commitSelectionEdit('Outline')}
            format={(v) => `${v.toFixed(1)} pt`}
          />
          <ColorPicker
            value={outline.color}
            onChange={(color) => editor.setSelectionOutline({ ...outline, color }, false)}
            onCommit={() => editor.commitSelectionEdit('Outline')}
          />
        </>
      ) : null}
    </>
  )
}

/**
 * The color of the selection; for ink, shapes and text also a gradient (linear or radial, with
 * as many colors as wanted).
 */
function SelectionColor({
  editor,
  color,
  gradient,
}: {
  editor: Editor
  color: string
  /** The selection's gradient; undefined when nothing selected can have one. */
  gradient: GradientPaint | null | undefined
}) {
  const [tab, setTab] = useState<'color' | 'gradient'>(gradient ? 'gradient' : 'color')
  const color_ = (
    <ColorPicker
      value={color}
      onChange={(next) => editor.recolorSelection(next, false)}
      onCommit={() => editor.commitSelectionEdit('Color')}
    />
  )
  if (gradient === undefined) return color_
  const startGradient: GradientPaint = gradient ?? {
    type: 'linear',
    angle: 90,
    stops: [
      { offset: 0, color },
      { offset: 1, color: '#4a80c0' },
    ],
  }
  return (
    <div className="grid gap-4">
      <div
        role="tablist"
        aria-label="Paint"
        className="flex gap-1 rounded-control bg-surface-sunken p-1"
      >
        {(
          [
            ['color', 'Color'],
            ['gradient', 'Gradient'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              editor.commitSelectionEdit('Color')
              setTab(value)
              // Opening the gradient tab shows a gradient at once.
              if (value === 'gradient' && !gradient) editor.paintSelection(startGradient, false)
            }}
            className={cn(
              'h-9 flex-1 rounded-[10px] text-sm font-semibold transition-colors',
              tab === value ? 'bg-surface-raised shadow-soft' : 'text-ink-muted hover:bg-hover',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'color' ? (
        color_
      ) : (
        <FillEditor
          value={gradient ?? startGradient}
          onChange={(fill) => editor.paintSelection(fill, false)}
        />
      )}
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
