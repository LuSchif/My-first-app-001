import { Copy, FilePlus2, LoaderCircle, MoreHorizontal, Share, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import type { Editor } from '../../engine/editor/Editor.ts'
import { PAGE_SIZE, type LayerDef, type Page } from '../../engine/model/types.ts'
import { drawPage, preloadPictures } from '../../engine/render/pageImage.ts'
import {
  Button,
  DialogContent,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useClosePopover,
} from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { exportPages, type ExportFormat } from './exporting.ts'

const THUMB_WIDTH = 168

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'pdf', label: 'PDF', hint: 'To print or share' },
  { format: 'jpg', label: 'JPG', hint: 'One picture per page' },
  { format: 'broomit', label: 'Broomit', hint: 'To keep editing in Broomit' },
]

/**
 * Every page of the notebook at a glance: jump to a page, add, duplicate or delete pages, and
 * export single pages or the whole notebook.
 */
export function PagesOverview({
  editor,
  doc,
  currentIndex,
  onClose,
}: {
  editor: Editor
  doc: NotebookDocument
  currentIndex: number
  onClose: () => void
}) {
  // `pageList` is a new array on every read, so it is kept in state and refreshed on changes.
  const [pages, setPages] = useState(() => doc.pageList)
  useEffect(() => doc.subscribe(() => setPages(doc.pageList)), [doc])
  const layers = useSyncExternalStore(
    (fn) => doc.subscribe(fn),
    () => doc.notebook.layers,
  )
  const background = useSyncExternalStore(
    (fn) => doc.subscribe(fn),
    () => doc.notebook.background,
  )
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (label: string, format: ExportFormat, indices?: number[]) => {
    setBusy(label)
    setError(null)
    try {
      await exportPages(doc, format, indices)
    } catch (err) {
      console.error(err)
      setError('The export did not work. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DialogContent title="Pages" className="w-[min(64rem,calc(100%-2rem))]">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold">Export notebook</span>
        {FORMATS.map(({ format, label }) => (
          <Button
            key={format}
            size="md"
            icon={
              busy === `all-${format}` ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Share size={16} />
              )
            }
            disabled={busy !== null}
            onClick={() => void run(`all-${format}`, format)}
          >
            {label}
          </Button>
        ))}
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-5 gap-y-6">
        {pages.map((page, index) => (
          <li key={page.id} className="grid gap-2">
            <button
              type="button"
              aria-label={`Go to page ${index + 1}`}
              onClick={() => {
                editor.scrollToPage(index)
                onClose()
              }}
              className={cn(
                'overflow-hidden rounded-md shadow-raised ring-offset-2 ring-offset-surface-raised transition-transform duration-150 active:scale-[0.98]',
                index === currentIndex ? 'ring-3 ring-caramel' : 'ring-1 ring-line',
              )}
            >
              <Thumbnail page={page} layers={layers} background={background} />
            </button>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tabular-nums">Page {index + 1}</span>
              <PageActions
                editor={editor}
                index={index}
                only={pages.length <= 1}
                busy={busy !== null}
                onExport={(format) => void run(`${page.id}-${format}`, format, [index])}
              />
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => editor.addPageAt(pages.length)}
            className="grid aspect-[595/842] w-full place-content-center justify-items-center gap-2 rounded-md text-sm font-semibold text-ink-muted ring-1 ring-line ring-inset hover:bg-hover"
          >
            <FilePlus2 size={22} />
            Add page
          </button>
        </li>
      </ul>
    </DialogContent>
  )
}

function PageActions({
  editor,
  index,
  only,
  busy,
  onExport,
}: {
  editor: Editor
  index: number
  only: boolean
  busy: boolean
  onExport: (format: ExportFormat) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={`More for page ${index + 1}`} icon={<MoreHorizontal size={20} />} />
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-64 gap-1 p-2">
        <PageActionList editor={editor} index={index} only={only} busy={busy} onExport={onExport} />
      </PopoverContent>
    </Popover>
  )
}

function PageActionList({
  editor,
  index,
  only,
  busy,
  onExport,
}: {
  editor: Editor
  index: number
  only: boolean
  busy: boolean
  onExport: (format: ExportFormat) => void
}) {
  const close = useClosePopover()
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <p className="px-3 pt-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        Export page
      </p>
      {FORMATS.map(({ format, label, hint }) => (
        <Button
          key={format}
          variant="ghost"
          className="h-auto min-h-11 justify-start py-1.5"
          disabled={busy}
          onClick={() => {
            onExport(format)
            close()
          }}
        >
          <span className="text-left">
            <span className="block">{label}</span>
            <span className="block text-xs font-normal text-ink-muted">{hint}</span>
          </span>
        </Button>
      ))}
      <span className="my-1 h-px bg-line" />
      <Button
        variant="ghost"
        className="justify-start"
        icon={<Copy size={18} />}
        onClick={() => {
          editor.duplicatePage(index)
          close()
        }}
      >
        Duplicate
      </Button>
      {confirm ? (
        <Button
          variant="danger"
          className="justify-start"
          icon={<Trash2 size={18} />}
          onClick={() => {
            editor.deletePage(index)
            close()
          }}
        >
          Delete page {index + 1}
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="justify-start text-danger"
          icon={<Trash2 size={18} />}
          disabled={only}
          onClick={() => setConfirm(true)}
        >
          Delete…
        </Button>
      )}
    </>
  )
}

/** A small picture of a page, redrawn when the page changes. */
function Thumbnail({
  page,
  layers,
  background,
}: {
  page: Page
  layers: readonly LayerDef[]
  background: string | undefined
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const scale = (THUMB_WIDTH * dpr) / PAGE_SIZE.width
    canvas.width = Math.round(PAGE_SIZE.width * scale)
    canvas.height = Math.round(PAGE_SIZE.height * scale)
    const draw = () => drawPage(canvas.getContext('2d')!, page, layers, scale, background)
    draw()
    let alive = true
    void preloadPictures([page]).then(() => alive && draw())
    return () => {
      alive = false
    }
  }, [page, layers, background])
  return <canvas ref={ref} className="block aspect-[595/842] w-full bg-paper" aria-hidden="true" />
}
