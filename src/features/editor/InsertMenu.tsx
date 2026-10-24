import { Camera, ChartColumn, ImagePlus, Table2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import { CHART_KINDS, createChart } from '../../engine/model/chart.ts'
import { newId } from '../../engine/model/ids.ts'
import { createTable, DEFAULT_TABLE_STYLE } from '../../engine/model/table.ts'
import type { ChartKind } from '../../engine/model/types.ts'
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  useClosePopover,
} from '../../design/index.ts'
import { CHART_ICONS } from './chartIcons.tsx'
import { insertPicture } from './images.ts'
import { Stepper } from './Stepper.tsx'

const ICON = { size: 22, strokeWidth: 1.75 }

/** Toolbar buttons that add a table, a chart, a picture from photos or a new photo. */
export function InsertTools({ editor, notebookId }: { editor: Editor; notebookId: string }) {
  const [error, setError] = useState<string | null>(null)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setError(null)
    insertPicture(editor, notebookId, file).catch((err: unknown) => {
      console.error(err)
      setError('This picture could not be added.')
    })
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="Table" icon={<Table2 {...ICON} />} />
        </PopoverTrigger>
        <PopoverContent className="grid w-72 gap-3">
          <TableSettings editor={editor} />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <IconButton label="Chart" icon={<ChartColumn {...ICON} />} />
        </PopoverTrigger>
        <PopoverContent className="grid w-72 gap-3">
          <ChartChoice editor={editor} />
        </PopoverContent>
      </Popover>
      <IconButton
        label="Picture from photos"
        icon={<ImagePlus {...ICON} />}
        onClick={() => library.current?.click()}
      />
      <IconButton
        label="Take a photo"
        icon={<Camera {...ICON} />}
        onClick={() => camera.current?.click()}
      />
      {error ? (
        <span role="alert" className="px-2 text-xs font-semibold text-danger">
          {error}
        </span>
      ) : null}
      <input
        ref={library}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.currentTarget)}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.currentTarget)}
      />
    </>
  )
}

function TableSettings({ editor }: { editor: Editor }) {
  const close = useClosePopover()
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [header, setHeader] = useState(true)
  return (
    <>
      <p className="text-sm font-semibold">New table</p>
      <Stepper label="Rows" value={rows} min={1} max={30} onChange={setRows} />
      <Stepper label="Columns" value={cols} min={1} max={12} onChange={setCols} />
      <Switch label="Header row" checked={header} onChange={setHeader} />
      <Button
        variant="primary"
        icon={<Table2 size={18} />}
        onClick={() => {
          editor.insertBox(
            (frame, layerId) =>
              createTable(newId(), layerId, frame, rows, cols, { ...DEFAULT_TABLE_STYLE, header }),
            cols * 90,
            rows * 26,
          )
          close()
        }}
      >
        Insert table
      </Button>
      <p className="text-xs text-ink-muted">You can also draw a table by hand: Auto table.</p>
    </>
  )
}

function ChartChoice({ editor }: { editor: Editor }) {
  const close = useClosePopover()
  const insert = (kind: ChartKind) => {
    editor.insertBox(
      (frame, layerId) => createChart(newId(), layerId, frame, kind),
      kind === 'pie' || kind === 'donut' ? 260 : 340,
      240,
    )
    close()
  }
  return (
    <>
      <p className="text-sm font-semibold">New chart</p>
      <div className="grid grid-cols-2 gap-2">
        {CHART_KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            onClick={() => insert(kind)}
            className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-control text-sm font-semibold ring-1 ring-line hover:bg-hover"
          >
            {CHART_ICONS[kind]}
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        Starts with sample data. Select it and tap Edit chart to enter yours.
      </p>
    </>
  )
}
