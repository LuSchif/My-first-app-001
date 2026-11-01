import { Check, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BroomitIcon, Button, IconButton } from '../../../design/index.ts'
import type { NotebookDocument } from '../../../engine/document/NotebookDocument.ts'
import { objectLabel, type Editor } from '../../../engine/editor/Editor.ts'
import { boundsOf } from '../../../engine/editor/selection.ts'
import type { CanvasObject, Notebook, Page } from '../../../engine/model/types.ts'
import { drawPage, preloadPictures } from '../../../engine/render/pageImage.ts'
import { pageSizeOf } from '../../../engine/render/layout.ts'
import { objectBounds } from '../../../engine/render/objects.ts'
import { cn } from '../../../lib/cn.ts'
import { showNotice } from '../../../lib/notices.ts'
import { bringObjects } from './copyAssets.ts'

/** The magnifier: its size on screen, how much it enlarges, and how far above the finger. */
const LENS = 150
const ZOOM = 2.5
const LIFT = 110
/** What the magnifier catches around its middle, in page points. */
const REACH = 22

/** Something the magnifier found: one object, or the writing (strokes) in its circle. */
interface Found {
  label: string
  objects: CanvasObject[]
}

/**
 * Taking one element out of another notebook: its pages are shown with only the magnifier.
 * Point at an element, choose it, and confirm; a copy goes onto the page in view.
 */
export function ExtractView({
  editor,
  doc,
  notebook,
  pages,
  onClose,
}: {
  editor: Editor
  doc: NotebookDocument
  notebook: Notebook
  pages: Page[]
  onClose: () => void
}) {
  const [found, setFound] = useState<{ pageIndex: number; items: Found[] } | null>(null)
  const [chosen, setChosen] = useState(0)
  const [busy, setBusy] = useState(false)
  const pick = found?.items[chosen]

  const confirm = () => {
    if (!pick) return
    setBusy(true)
    bringObjects(pick.objects, doc.notebook.id)
      .then((objects) => {
        editor.placeObjects(objects)
        showNotice(`${pick.label} added.`)
        onClose()
      })
      .catch((err: unknown) => {
        console.error(err)
        showNotice('It could not be added.')
      })
      .finally(() => setBusy(false))
  }

  return createPortal(
    <div
      role="dialog"
      aria-label={`Take out an element from ${notebook.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-desk"
    >
      <header className="flex items-center gap-3 border-b border-line bg-surface-raised px-4 pt-[calc(10px+env(safe-area-inset-top))] pb-2.5 shadow-soft">
        <IconButton label="Cancel" icon={<X size={22} />} onClick={onClose} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{notebook.title}</p>
          <p className="text-xs text-ink-muted">
            Point at what you want with the magnifier, then add it.
          </p>
        </div>
        {/* The only tool here. */}
        <span
          aria-label="Magnifier"
          className="grid size-11 place-items-center rounded-control bg-icon-fill text-icon-line ring-1 ring-icon-accent"
        >
          <BroomitIcon name="magnifier" size={24} colored />
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <ol className="mx-auto grid w-full max-w-3xl gap-6">
          {pages.map((page, i) => (
            <li key={page.id} className="grid gap-1.5">
              <span className="text-xs font-semibold text-ink-muted">Page {i + 1}</span>
              <LookPage
                page={page}
                notebook={notebook}
                highlight={found?.pageIndex === i && pick ? boundsOf(pick.objects) : null}
                onFound={(items) => {
                  setFound(items.length ? { pageIndex: i, items } : null)
                  setChosen(0)
                  if (!items.length) showNotice('Nothing there. Point right at an element.')
                }}
              />
            </li>
          ))}
        </ol>
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-raised px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        {found ? (
          <div
            role="radiogroup"
            aria-label="Found"
            className="flex min-w-0 flex-1 flex-wrap gap-1.5"
          >
            {found.items.map((item, i) => (
              <button
                key={`${item.label}-${i}`}
                type="button"
                role="radio"
                aria-checked={chosen === i}
                onClick={() => setChosen(i)}
                className="h-10 rounded-full px-3 text-sm font-semibold ring-1 ring-line hover:bg-hover aria-checked:bg-ink aria-checked:text-ink-inverse aria-checked:ring-ink"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-ink-muted">Nothing chosen yet.</p>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon={<Check size={18} />}
          disabled={!pick || busy}
          onClick={confirm}
        >
          Add to my page
        </Button>
      </footer>
    </div>,
    document.body,
  )
}

/** One page, drawn large, with the magnifier following the finger or pen. */
function LookPage({
  page,
  notebook,
  highlight,
  onFound,
}: {
  page: Page
  notebook: Notebook
  highlight: { minX: number; minY: number; maxX: number; maxY: number } | null
  onFound: (items: Found[]) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const lens = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [look, setLook] = useState<{ x: number; y: number } | null>(null)
  const size = useMemo(() => pageSizeOf(notebook), [notebook])
  const scale = width / size.width

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const measure = () => setWidth(c.parentElement!.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(c.parentElement!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const c = canvas.current
    if (!c || !width) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(size.width * scale * dpr)
    c.height = Math.round(size.height * scale * dpr)
    const draw = () =>
      drawPage(c.getContext('2d')!, page, notebook.layers, scale * dpr, notebook.background, size)
    draw()
    let alive = true
    void preloadPictures([page]).then(() => alive && draw())
    return () => {
      alive = false
    }
  }, [page, notebook, width, scale, size])

  // The lens shows the page enlarged around the spot.
  useEffect(() => {
    const l = lens.current
    const c = canvas.current
    if (!l || !c || !look) return
    const dpr = window.devicePixelRatio || 1
    l.width = LENS * dpr
    l.height = LENS * dpr
    const ctx = l.getContext('2d')!
    const span = (LENS / ZOOM) * dpr
    ctx.clearRect(0, 0, l.width, l.height)
    ctx.drawImage(
      c,
      look.x * dpr - span / 2,
      look.y * dpr - span / 2,
      span,
      span,
      0,
      0,
      l.width,
      l.height,
    )
  }, [look])

  const at = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const finish = (spot: { x: number; y: number }) => {
    const x = spot.x / scale
    const y = spot.y / scale
    const shown = new Set(notebook.layers.filter((l) => l.visible).map((l) => l.id))
    const near = page.objects.filter((o) => {
      if (!shown.has(o.layerId)) return false
      const b = objectBounds(o)
      return (
        x >= b.minX - REACH && x <= b.maxX + REACH && y >= b.minY - REACH && y <= b.maxY + REACH
      )
    })
    const inside = (o: CanvasObject) => {
      const b = objectBounds(o)
      return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
    }
    const items: Found[] = []
    // Topmost first: boxes, text and fills the spot is on.
    for (const o of [...near].reverse()) {
      if (o.type !== 'stroke' && inside(o)) items.push({ label: objectLabel(o), objects: [o] })
    }
    const strokes = near.filter((o) => o.type === 'stroke')
    if (strokes.length > 1) {
      items.push({ label: `Writing (${strokes.length} strokes)`, objects: strokes })
    } else if (strokes.length === 1) {
      items.push({ label: objectLabel(strokes[0]!), objects: strokes })
    }
    onFound(items)
  }

  return (
    <div
      className="relative touch-none overflow-hidden rounded-md bg-paper shadow-raised ring-1 ring-line select-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setLook(at(e))
      }}
      onPointerMove={(e) => look && setLook(at(e))}
      onPointerUp={(e) => {
        const spot = at(e)
        setLook(null)
        finish(spot)
      }}
      onPointerCancel={() => setLook(null)}
    >
      <canvas
        ref={canvas}
        className="block w-full"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
        aria-hidden="true"
      />
      {highlight ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md ring-3 ring-accent"
          style={{
            left: (highlight.minX - 6) * scale,
            top: (highlight.minY - 6) * scale,
            width: (highlight.maxX - highlight.minX + 12) * scale,
            height: (highlight.maxY - highlight.minY + 12) * scale,
          }}
        />
      ) : null}
      {look ? (
        // The handle of the magnifying glass, below the lens to the right.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-3.5 w-12 origin-left rotate-45 rounded-full bg-ink shadow-soft"
          style={{
            left: look.x + (LENS / 2) * Math.SQRT1_2,
            top: Math.max(0, look.y - LIFT - LENS / 2) + LENS / 2 + (LENS / 2) * Math.SQRT1_2 - 7,
          }}
        />
      ) : null}
      {look ? (
        <canvas
          ref={lens}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute rounded-full bg-paper shadow-overlay ring-4 ring-ink',
          )}
          style={{
            width: LENS,
            height: LENS,
            left: look.x - LENS / 2,
            top: Math.max(0, look.y - LIFT - LENS / 2),
          }}
        />
      ) : null}
    </div>
  )
}
