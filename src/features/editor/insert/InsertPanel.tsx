import {
  Camera,
  ChartColumn,
  FolderOpen,
  ImagePlus,
  Images,
  Shapes,
  Sticker as StickerIcon,
  Table2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconButton, Switch } from '../../../design/index.ts'
import type { NotebookDocument } from '../../../engine/document/NotebookDocument.ts'
import type { Editor, EditorState } from '../../../engine/editor/Editor.ts'
import { CHART_KINDS, createChart } from '../../../engine/model/chart.ts'
import { newId } from '../../../engine/model/ids.ts'
import { createTable, DEFAULT_TABLE_STYLE } from '../../../engine/model/table.ts'
import type { BoxFrame, CanvasObject, ChartKind, Id } from '../../../engine/model/types.ts'
import { cn } from '../../../lib/cn.ts'
import { showNotice } from '../../../lib/notices.ts'
import { db } from '../../../storage/db.ts'
import { getAssetBlob } from '../../../storage/notebooks.ts'
import { CHART_ICONS } from '../chartIcons.tsx'
import { insertImageBlob, insertPicture, placeAsset, svgToPng } from '../images.ts'
import { Stepper } from '../Stepper.tsx'
import { FoldersTab } from './FoldersTab.tsx'
import { SHAPES, shapePath, shapeStroke } from './shapes.ts'
import { STICKERS } from './stickers.ts'
import { useDragToPage, type DragGhost } from './useDragToPage.ts'

type Tab = 'shapes' | 'tables' | 'stickers' | 'photos' | 'folders'

const TABS: { id: Tab; label: string; icon: typeof Shapes }[] = [
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'stickers', label: 'Stickers', icon: StickerIcon },
  { id: 'photos', label: 'Photos', icon: Images },
  { id: 'folders', label: 'Folders', icon: FolderOpen },
]

type Source = ReturnType<typeof useDragToPage>['source']

/**
 * The panel of things to add, on the left beside the page (which makes room for it): shapes,
 * tables and charts, stickers, photos, and pages or parts of other notebooks. Tap one to add it
 * in the middle of the view, or drag it to a spot on the page.
 */
export function InsertPanel({
  editor,
  state,
  doc,
  onClose,
}: {
  editor: Editor
  state: EditorState
  doc: NotebookDocument
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('shapes')
  const { source, ghost } = useDragToPage()
  const notebookId = doc.notebook.id
  const missed = () => showNotice('Drop it on a page.')

  return (
    <aside
      aria-label="Shapes, stickers and more"
      className="flex h-full w-[min(34vw,26rem)] min-w-[19rem] shrink-0 flex-col border-r border-line bg-surface-raised pt-[env(safe-area-inset-top)]"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-lg font-bold">Add to the page</h2>
        <IconButton label="Close" icon={<X size={20} />} onClick={onClose} />
      </div>
      <div role="tablist" aria-label="What to add" className="grid grid-cols-5 gap-1 px-3 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="grid justify-items-center gap-0.5 rounded-control py-1.5 text-[11px] font-semibold text-ink-muted hover:bg-hover aria-selected:bg-ink aria-selected:text-ink-inverse"
          >
            <Icon size={20} strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>
      <p className="px-4 pb-2 text-xs text-ink-muted">
        {tab === 'folders'
          ? 'Open a notebook to drag its pages onto your page.'
          : 'Tap to add in the middle, or drag onto the page.'}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {tab === 'shapes' ? (
          <ShapesTab editor={editor} state={state} source={source} missed={missed} />
        ) : tab === 'tables' ? (
          <TablesTab editor={editor} source={source} missed={missed} />
        ) : tab === 'stickers' ? (
          <StickersTab editor={editor} notebookId={notebookId} source={source} missed={missed} />
        ) : tab === 'photos' ? (
          <PhotosTab
            editor={editor}
            doc={doc}
            notebookId={notebookId}
            source={source}
            missed={missed}
          />
        ) : (
          <FoldersTab editor={editor} doc={doc} source={source} />
        )}
      </div>
      {ghost ? <Ghost ghost={ghost} /> : null}
    </aside>
  )
}

function Ghost({ ghost }: { ghost: DragGhost }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink-inverse shadow-overlay"
      style={{ left: ghost.x, top: ghost.y }}
    >
      {ghost.label}
    </span>
  )
}

const tile =
  'grid content-center justify-items-center gap-1 rounded-card bg-surface p-2 text-xs font-semibold ring-1 ring-line select-none hover:bg-surface-sunken active:scale-[0.97]'

function ShapesTab({
  editor,
  state,
  source,
  missed,
}: {
  editor: Editor
  state: EditorState
  source: Source
  missed: () => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SHAPES.map((shape) => {
        const make = (frame: BoxFrame, layerId: Id) => shapeStroke(shape, frame, layerId, state.pen)
        return (
          <button
            key={shape.id}
            type="button"
            className={tile}
            {...source(
              shape.label,
              () => editor.insertBox(make, shape.width, shape.height),
              (x, y) => editor.dropBox(make, shape.width, shape.height, x, y) || missed(),
            )}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
              <path
                d={shapePath(shape, 40)}
                transform="translate(4 4)"
                fill="none"
                stroke={state.pen.color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            {shape.label}
          </button>
        )
      })}
    </div>
  )
}

const TABLE_PRESETS = [
  [2, 2],
  [3, 3],
  [4, 4],
  [3, 5],
] as const

function TablesTab({
  editor,
  source,
  missed,
}: {
  editor: Editor
  source: Source
  missed: () => void
}) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [header, setHeader] = useState(true)
  const table = (r: number, c: number) => ({
    make: (frame: BoxFrame, layerId: Id) =>
      createTable(newId(), layerId, frame, r, c, { ...DEFAULT_TABLE_STYLE, header }),
    width: c * 90,
    height: r * 26,
  })
  const chart = (kind: ChartKind) => ({
    make: (frame: BoxFrame, layerId: Id) => createChart(newId(), layerId, frame, kind),
    width: kind === 'pie' || kind === 'donut' ? 260 : 340,
    height: 240,
  })
  const add = (
    label: string,
    item: { make: (frame: BoxFrame, layerId: Id) => CanvasObject; width: number; height: number },
  ) =>
    source(
      label,
      () => editor.insertBox(item.make, item.width, item.height),
      (x, y) => editor.dropBox(item.make, item.width, item.height, x, y) || missed(),
    )

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">Tables</h3>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_PRESETS.map(([r, c]) => (
            <button
              key={`${r}x${c}`}
              type="button"
              className={tile}
              {...add(`Table ${r} × ${c}`, table(r, c))}
            >
              <TableIcon rows={r} cols={c} header={header} />
              {r} × {c}
            </button>
          ))}
        </div>
        <div className="grid gap-2 rounded-card p-3 ring-1 ring-line">
          <Stepper label="Rows" value={rows} min={1} max={30} onChange={setRows} />
          <Stepper label="Columns" value={cols} min={1} max={12} onChange={setCols} />
          <Switch label="Header row" checked={header} onChange={setHeader} />
          <button
            type="button"
            className="flex h-11 items-center justify-center gap-2 rounded-control bg-ink text-sm font-semibold text-ink-inverse"
            {...add(`Table ${rows} × ${cols}`, table(rows, cols))}
          >
            <Table2 size={18} /> Table {rows} × {cols}
          </button>
        </div>
      </section>
      <section className="grid gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ChartColumn size={16} /> Charts
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {CHART_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              className={cn(tile, 'min-h-16')}
              {...add(`${label} chart`, chart(kind))}
            >
              {CHART_ICONS[kind]}
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          Charts start with sample data. Select one and tap Edit chart to enter yours.
        </p>
      </section>
    </div>
  )
}

function TableIcon({ rows, cols, header }: { rows: number; cols: number; header: boolean }) {
  const w = 44
  const h = 30
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      className="text-ink-muted"
    >
      {header ? (
        <rect x="1" y="1" width={w - 2} height={(h - 2) / rows} className="fill-surface-sunken" />
      ) : null}
      <rect
        x="1"
        y="1"
        width={w - 2}
        height={h - 2}
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line
          key={`r${i}`}
          x1="1"
          x2={w - 1}
          y1={1 + ((i + 1) * (h - 2)) / rows}
          y2={1 + ((i + 1) * (h - 2)) / rows}
          stroke="currentColor"
        />
      ))}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line
          key={`c${i}`}
          y1="1"
          y2={h - 1}
          x1={1 + ((i + 1) * (w - 2)) / cols}
          x2={1 + ((i + 1) * (w - 2)) / cols}
          stroke="currentColor"
        />
      ))}
    </svg>
  )
}

function StickersTab({
  editor,
  notebookId,
  source,
  missed,
}: {
  editor: Editor
  notebookId: string
  source: Source
  missed: () => void
}) {
  const add = (svg: string, drop?: { clientX: number; clientY: number }) => {
    if (drop && !editor.pagePointAt(drop.clientX, drop.clientY)) {
      missed()
      return
    }
    svgToPng(svg, 480)
      .then((blob) => insertImageBlob(editor, notebookId, blob, drop, 0.22, true))
      .catch((err: unknown) => {
        console.error(err)
        showNotice('The sticker could not be added.')
      })
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {STICKERS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-label={s.label}
          className={cn(tile, 'aspect-square p-1.5')}
          {...source(
            s.label,
            () => add(s.svg),
            (clientX, clientY) => add(s.svg, { clientX, clientY }),
          )}
        >
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.svg)}`}
            alt=""
            draggable={false}
            className="pointer-events-none size-full object-contain"
          />
        </button>
      ))}
    </div>
  )
}

/** The pictures already in this notebook, so one can be used again. */
function useNotebookPictures(doc: NotebookDocument): Id[] {
  return useMemo(() => {
    const ids = new Set<Id>()
    for (const page of doc.pageList) {
      for (const o of page.objects) if (o.type === 'image' && !o.sticker) ids.add(o.assetId)
    }
    return [...ids]
  }, [doc.pageList])
}

function PhotosTab({
  editor,
  doc,
  notebookId,
  source,
  missed,
}: {
  editor: Editor
  doc: NotebookDocument
  notebookId: string
  source: Source
  missed: () => void
}) {
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const pictures = useNotebookPictures(doc)
  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    insertPicture(editor, notebookId, file).catch((err: unknown) => {
      console.error(err)
      showNotice('This picture could not be added.')
    })
  }
  const reuse = async (assetId: Id, drop?: { clientX: number; clientY: number }) => {
    const asset = await db.assets.get(assetId)
    if (!asset) return
    if (drop && !editor.pagePointAt(drop.clientX, drop.clientY)) missed()
    else placeAsset(editor, assetId, asset.width, asset.height, drop)
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(tile, 'min-h-20')}
          onClick={() => library.current?.click()}
        >
          <ImagePlus size={24} strokeWidth={1.75} />
          Photo library
        </button>
        <button
          type="button"
          className={cn(tile, 'min-h-20')}
          onClick={() => camera.current?.click()}
        >
          <Camera size={24} strokeWidth={1.75} />
          Take a photo
        </button>
      </div>
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
      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">In this notebook</h3>
        {pictures.length === 0 ? (
          <p className="text-sm text-ink-muted">Pictures you add show up here, to use again.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pictures.map((id) => (
              <button
                key={id}
                type="button"
                aria-label="Use this picture again"
                className={cn(tile, 'aspect-square overflow-hidden p-0')}
                {...source(
                  'Picture',
                  () => void reuse(id),
                  (clientX, clientY) => void reuse(id, { clientX, clientY }),
                )}
              >
                <AssetImage assetId={id} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AssetImage({ assetId }: { assetId: Id }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    void getAssetBlob(assetId).then((blob) => {
      if (!alive || !blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [assetId])
  return url ? (
    <img
      src={url}
      alt=""
      draggable={false}
      className="pointer-events-none size-full object-cover"
    />
  ) : null
}
