import { Camera, ChartColumn, ChevronLeft, ImagePlus, Plus, Table2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import { newId } from '../../engine/model/ids.ts'
import { CHART_KINDS, createChart } from '../../engine/model/chart.ts'
import { createTable, DEFAULT_TABLE_STYLE } from '../../engine/model/table.ts'
import type { ChartKind } from '../../engine/model/types.ts'
import { CHART_ICONS } from './chartIcons.tsx'
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '../../design/index.ts'
import { insertPicture } from './images.ts'
import { Stepper } from './Stepper.tsx'

/** Adds pictures, tables and charts to the current page. */
export function InsertMenu({ editor, notebookId }: { editor: Editor; notebookId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'menu' | 'table' | 'chart'>('menu')
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [header, setHeader] = useState(true)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const close = () => {
    setOpen(false)
    setError(null)
    setView('menu')
  }

  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    close()
    insertPicture(editor, notebookId, file).catch((err: unknown) => {
      console.error(err)
      setError('This picture could not be added.')
      setOpen(true)
    })
  }

  const insertTable = () => {
    editor.insertBox(
      (frame, layerId) =>
        createTable(newId(), layerId, frame, rows, cols, { ...DEFAULT_TABLE_STYLE, header }),
      cols * 90,
      rows * 26,
    )
    close()
  }

  const insertChart = (kind: ChartKind) => {
    editor.insertBox(
      (frame, layerId) => createChart(newId(), layerId, frame, kind),
      kind === 'pie' || kind === 'donut' ? 260 : 340,
      240,
    )
    close()
  }

  // The file fields live outside the menu: it closes while the photo picker is open, and the
  // fields must still be there when the picture comes back.
  return (
    <>
      <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <PopoverTrigger asChild>
          <IconButton label="Insert" icon={<Plus size={22} strokeWidth={1.75} />} />
        </PopoverTrigger>
        <PopoverContent className="grid w-72 gap-1 p-2">
          {view === 'chart' ? (
            <div className="grid gap-3 p-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="-ml-1 flex items-center gap-1 text-sm font-semibold"
              >
                <ChevronLeft size={16} />
                Chart
              </button>
              <div className="grid grid-cols-2 gap-2">
                {CHART_KINDS.map(({ kind, label }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => insertChart(kind)}
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
            </div>
          ) : view === 'table' ? (
            <div className="grid gap-3 p-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="-ml-1 flex items-center gap-1 text-sm font-semibold"
              >
                <ChevronLeft size={16} />
                Table
              </button>
              <Stepper label="Rows" value={rows} min={1} max={30} onChange={setRows} />
              <Stepper label="Columns" value={cols} min={1} max={12} onChange={setCols} />
              <Switch label="Header row" checked={header} onChange={setHeader} />
              <Button variant="primary" icon={<Table2 size={18} />} onClick={insertTable}>
                Insert table
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="ghost"
                className="justify-start"
                icon={<ImagePlus size={18} />}
                onClick={() => library.current?.click()}
              >
                Picture from photos
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                icon={<Camera size={18} />}
                onClick={() => camera.current?.click()}
              >
                Take a photo
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                icon={<Table2 size={18} />}
                onClick={() => setView('table')}
              >
                Table…
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                icon={<ChartColumn size={18} />}
                onClick={() => setView('chart')}
              >
                Chart…
              </Button>
              {error ? <p className="px-3 py-1 text-sm text-danger">{error}</p> : null}
            </>
          )}
        </PopoverContent>
      </Popover>
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
