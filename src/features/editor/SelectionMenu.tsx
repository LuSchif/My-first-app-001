import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  FlipHorizontal2,
  FlipVertical2,
  Layers,
  Scaling,
  Grid3x3,
  ChartColumn,
  Scissors,
  Table2,
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
  PAGE_SIZE,
  type ChartKind,
  type Outline,
  type TableObject,
} from '../../engine/model/types.ts'
import { ChartEditor } from './ChartEditor.tsx'
import { TableEditor } from './TableEditor.tsx'
import { useState } from 'react'

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
      className="absolute z-10 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
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
      {sel.boxKind === 'table' ? <TableActions editor={editor} /> : null}
      {sel.boxKind === 'chart' ? <ChartActions editor={editor} /> : null}
      <MenuButton label="Copy" onClick={() => editor.copySelection()}>
        <Copy size={18} />
      </MenuButton>
      <MenuButton label="Cut" onClick={() => editor.cutSelection()}>
        <Scissors size={18} />
      </MenuButton>
      {/* Charts and pictures keep their own colors. */}
      {sel.boxKind === 'chart' || sel.boxKind === 'image' ? null : (
        <>
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
              <SelectionColor editor={editor} color={sel.color ?? '#3e2d25'} />
            </PopoverContent>
          </Popover>
        </>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
          >
            <SquareRoundCorner size={18} />
            Outline
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-80 gap-4">
          <OutlineControls editor={editor} outline={sel.outline} />
        </PopoverContent>
      </Popover>
      {state.layers.length > 1 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
            >
              <Layers size={18} />
              Layer
            </button>
          </PopoverTrigger>
          <PopoverContent className="grid w-64 gap-1">
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
      ) : null}
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
      {/* A table is not mirrored; flipping would only scramble it. */}
      {sel.boxKind === 'table' ? null : (
        <>
          {/* Lucide names these icons by their axis line, the opposite of the action. */}
          <MenuButton
            label="Flip horizontally"
            iconOnly
            onClick={() => editor.flipSelection('horizontal')}
          >
            <FlipVertical2 size={18} />
          </MenuButton>
          {/* A chart has no top-to-bottom mirror image that still reads as a chart. */}
          {sel.boxKind === 'chart' ? null : (
            <MenuButton
              label="Flip vertically"
              iconOnly
              onClick={() => editor.flipSelection('vertical')}
            >
              <FlipHorizontal2 size={18} />
            </MenuButton>
          )}
        </>
      )}
      <MenuButton label="Delete" onClick={() => editor.deleteSelection()}>
        <Trash2 size={18} />
      </MenuButton>
    </div>
  )
}

/** Editing a selected table, and growing it with the spacing it already has. */
function TableActions({ editor }: { editor: Editor }) {
  const [editing, setEditing] = useState(false)
  const table = editor.selectedObject()
  if (table?.type !== 'table') return null
  // A table that grows past the page edge shrinks its columns or rows to fit the page.
  const resize = (next: typeof table, label: string) =>
    editor.updateSelectedObject(fitToPage(next, PAGE_SIZE.width, PAGE_SIZE.height), label)
  return (
    <>
      <MenuButton label="Edit table" onClick={() => setEditing(true)}>
        <Table2 size={18} />
      </MenuButton>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
          >
            <Grid3x3 size={18} />
            Rows &amp; columns
          </button>
        </PopoverTrigger>
        <PopoverContent className="grid w-72 gap-3">
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
      {hasChartData(table) ? <MakeChart editor={editor} table={table} /> : null}
      <TableEditor editor={editor} table={table} open={editing} onOpenChange={setEditing} />
    </>
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
      right + width <= PAGE_SIZE.width
        ? { x: right, y: table.y }
        : { x: table.x, y: table.y + table.height + 16 }
    editor.insertBox(
      (frame, layerId) => chartFromData(newId(), layerId, frame, kind, data),
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
          <ChartColumn size={18} />
          Make chart
        </button>
      </PopoverTrigger>
      <PopoverContent className="grid w-72 gap-3">
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

function ChartActions({ editor }: { editor: Editor }) {
  const [editing, setEditing] = useState(false)
  const chart = editor.selectedObject()
  if (chart?.type !== 'chart') return null
  return (
    <>
      <MenuButton label="Edit chart" onClick={() => setEditing(true)}>
        <ChartColumn size={18} />
      </MenuButton>
      <ChartEditor editor={editor} chart={chart} open={editing} onOpenChange={setEditing} />
    </>
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

function SelectionColor({ editor, color }: { editor: Editor; color: string }) {
  return (
    <ColorPicker
      value={color}
      onChange={(next) => editor.recolorSelection(next, false)}
      onCommit={() => editor.commitSelectionEdit('Color')}
    />
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

/** After a long press on the page: pastes what was copied right there. */
export function PasteMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const at = state.pasteMenu
  if (!at) return null
  return (
    <div
      role="menu"
      aria-label="Paste"
      className="absolute z-20 flex -translate-x-1/2 animate-pop-in items-center gap-0.5 rounded-panel bg-ink p-1 text-ink-inverse shadow-overlay"
      style={{ left: `clamp(6rem, ${at.x}px, calc(100% - 6rem))`, top: Math.max(72, at.y - 64) }}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => editor.pasteHere()}
        className="flex h-11 items-center gap-2 rounded-control px-4 text-sm font-semibold hover:bg-white/10 active:bg-white/15"
      >
        <ClipboardPaste size={18} />
        Paste
      </button>
    </div>
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
