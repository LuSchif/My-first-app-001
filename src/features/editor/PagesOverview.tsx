import { ArrowDown, ArrowRight, Copy, FilePlus2, LoaderCircle, Share, Trash2 } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import type { Editor } from '../../engine/editor/Editor.ts'
import type { PageFlow, PaperKind } from '../../engine/model/types.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import {
  Button,
  DialogContent,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useClosePopover,
} from '../../design/index.ts'
import { PAPER_OPTIONS, paperPreviewStyle } from '../paper.ts'
import { exportPages, type ExportFormat } from './exporting.ts'
import { PageThumbnail } from './PageThumbnail.tsx'

const THUMB_WIDTH = 168

const FORMATS: { format: ExportFormat; label: string; hint: string }[] = [
  { format: 'pdf', label: 'PDF', hint: 'To print or share' },
  { format: 'jpg', label: 'JPG', hint: 'One picture per page' },
  { format: 'broomit', label: 'Broomit', hint: 'To keep editing in Broomit' },
]

/**
 * Every page of the notebook at a glance. Tapping a page opens a small card for it: open it,
 * change its paper, export, duplicate or delete it. Above the pages: which way pages follow,
 * the paper of new pages, and exporting the whole notebook.
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
  const newPaper = useSyncExternalStore(
    (fn) => doc.subscribe(fn),
    () => doc.notebook.paper,
  )
  const flow = useSyncExternalStore(
    (fn) => doc.subscribe(fn),
    () => doc.notebook.pageFlow ?? 'vertical',
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
        {editor.kind === 'notebook' ? (
          <div role="radiogroup" aria-label="Pages follow" className="flex items-center gap-1">
            <span className="mr-1 text-sm font-semibold">Pages follow</span>
            {FLOWS.map(({ flow: f, label, icon }) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={flow === f}
                onClick={() => editor.setPageFlow(f)}
                className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-ink-muted ring-1 ring-line hover:bg-hover aria-checked:bg-ink aria-checked:text-ink-inverse aria-checked:ring-ink"
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <span className="flex-1" />
        <NewPagesPaper editor={editor} paper={newPaper} />
        <ExportNotebook busy={busy} onExport={(format) => void run(`all-${format}`, format)} />
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      <p className="mb-3 text-sm text-ink-muted">
        Tap a page to open it, change its paper, or export it.
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-x-5 gap-y-6">
        {pages.map((page, index) => (
          <li key={page.id} className="grid gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Page ${index + 1}`}
                  aria-current={index === currentIndex}
                  className="overflow-hidden rounded-md shadow-raised ring-1 ring-line transition-transform duration-150 active:scale-[0.98]"
                >
                  <PageThumbnail
                    width={THUMB_WIDTH}
                    page={page}
                    layers={layers}
                    background={background}
                    size={pageSizeOf(doc.notebook)}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="grid w-80 gap-4">
                <PageCard
                  editor={editor}
                  index={index}
                  paper={page.paper}
                  only={pages.length <= 1}
                  busy={busy !== null}
                  onOpen={() => {
                    editor.scrollToPage(index)
                    onClose()
                  }}
                  onExport={(format) => void run(`${page.id}-${format}`, format, [index])}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm font-semibold tabular-nums">
              Page {index + 1}
              <span className="font-normal text-ink-muted"> · {paperLabel(page.paper)}</span>
            </span>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => editor.addPageAt(pages.length)}
            style={{ aspectRatio: `${editor.pageSize.width} / ${editor.pageSize.height}` }}
            className="grid w-full place-content-center justify-items-center gap-2 rounded-md text-sm font-semibold text-ink-muted ring-1 ring-line ring-inset hover:bg-hover"
          >
            <FilePlus2 size={22} />
            Add page
          </button>
        </li>
      </ul>
    </DialogContent>
  )
}

const FLOWS: { flow: PageFlow; label: string; icon: React.ReactNode }[] = [
  { flow: 'vertical', label: 'Down', icon: <ArrowDown size={16} /> },
  { flow: 'horizontal', label: 'To the side', icon: <ArrowRight size={16} /> },
]

function paperLabel(kind: PaperKind): string {
  return PAPER_OPTIONS.find((o) => o.kind === kind)?.label ?? kind
}

/** Five small papers to choose from; the chosen one is outlined. */
function PaperChoice({
  value,
  onChange,
}: {
  value: PaperKind
  onChange: (kind: PaperKind) => void
}) {
  return (
    <div role="radiogroup" aria-label="Paper" className="grid grid-cols-5 gap-2">
      {PAPER_OPTIONS.map((option) => (
        <button
          key={option.kind}
          type="button"
          role="radio"
          aria-checked={value === option.kind}
          aria-label={option.label}
          onClick={() => onChange(option.kind)}
          className="group grid gap-1 rounded-lg p-1 text-xs"
        >
          <span
            className="aspect-[3/4] w-full rounded-md shadow-soft ring-1 ring-line"
            style={paperPreviewStyle(option.kind)}
          />
          <span className="text-ink-muted group-aria-checked:font-semibold group-aria-checked:text-ink">
            {option.label}
          </span>
        </button>
      ))}
    </div>
  )
}

/** One page: open it, change its paper, export, duplicate or delete it. */
function PageCard({
  editor,
  index,
  paper,
  only,
  busy,
  onOpen,
  onExport,
}: {
  editor: Editor
  index: number
  paper: PaperKind
  only: boolean
  busy: boolean
  onOpen: () => void
  onExport: (format: ExportFormat) => void
}) {
  const close = useClosePopover()
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Page {index + 1}</p>
        <Button variant="primary" size="md" onClick={onOpen}>
          Open page
        </Button>
      </div>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Paper</h3>
        <PaperChoice value={paper} onChange={(kind) => editor.setPaper(kind, 'page', index)} />
      </section>
      <section className="grid gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Export page
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMATS.map(({ format, label }) => (
            <Button
              key={format}
              size="md"
              disabled={busy}
              onClick={() => {
                onExport(format)
                close()
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>
      <div className="grid grid-cols-2 gap-1.5 border-t border-line pt-3">
        <Button
          size="md"
          icon={<Copy size={16} />}
          onClick={() => {
            editor.duplicatePage(index)
            close()
          }}
        >
          Duplicate
        </Button>
        {confirm ? (
          <Button
            size="md"
            variant="danger"
            icon={<Trash2 size={16} />}
            onClick={() => {
              editor.deletePage(index)
              close()
            }}
          >
            Delete page
          </Button>
        ) : (
          <Button
            size="md"
            className="text-danger"
            icon={<Trash2 size={16} />}
            disabled={only}
            onClick={() => setConfirm(true)}
          >
            Delete…
          </Button>
        )}
      </div>
    </>
  )
}

/** The paper pages added from now on get, and a way to give it to every page. */
function NewPagesPaper({ editor, paper }: { editor: Editor; paper: PaperKind }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-sm font-semibold ring-1 ring-line hover:bg-hover"
        >
          <span className="size-7 rounded-full ring-1 ring-line" style={paperPreviewStyle(paper)} />
          New pages: {paperLabel(paper)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <p className="text-sm font-semibold">Paper for new pages</p>
        <PaperChoice value={paper} onChange={(kind) => editor.setPaper(kind, 'new')} />
        <Button size="md" onClick={() => editor.setPaper(paper, 'all')}>
          Use {paperLabel(paper)} on every page
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function ExportNotebook({
  busy,
  onExport,
}: {
  busy: string | null
  onExport: (format: ExportFormat) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="md"
          icon={
            busy?.startsWith('all-') ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Share size={16} />
            )
          }
        >
          Export notebook
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-64 gap-1 p-2">
        <ExportList busy={busy !== null} onExport={onExport} />
      </PopoverContent>
    </Popover>
  )
}

function ExportList({
  busy,
  onExport,
}: {
  busy: boolean
  onExport: (format: ExportFormat) => void
}) {
  const close = useClosePopover()
  return FORMATS.map(({ format, label, hint }) => (
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
  ))
}
