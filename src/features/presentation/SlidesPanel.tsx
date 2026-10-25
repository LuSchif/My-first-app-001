import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { PageThumbnail } from '../editor/PageThumbnail.tsx'
import { useDocVersion } from './useDocVersion.ts'

export const SLIDES_PANEL_WIDTH = 196
const THUMB_WIDTH = 148

/** The slides of a presentation, down the left edge: tap one to edit it; add, copy, move, delete. */
export function SlidesPanel({
  editor,
  state,
  doc,
}: {
  editor: Editor
  state: EditorState
  doc: NotebookDocument
}) {
  useDocVersion(doc)
  const pages = doc.pageList
  const size = pageSizeOf(doc.notebook)
  const current = state.pageIndex
  const list = useRef<HTMLOListElement>(null)

  // The slide in view stays in view in the list too.
  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <aside
      aria-label="Slides"
      className="flex h-full shrink-0 flex-col border-r border-line bg-surface pt-[calc(76px+env(safe-area-inset-top))]"
      style={{ width: SLIDES_PANEL_WIDTH }}
    >
      <ol ref={list} className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-3 pb-3">
        {pages.map((page, index) => (
          <li key={page.id} className="flex items-start gap-1.5">
            <span className="w-4 shrink-0 pt-1 text-right text-xs font-semibold text-ink-muted tabular-nums">
              {index + 1}
            </span>
            <div className="relative min-w-0 flex-1">
              <button
                type="button"
                aria-label={`Slide ${index + 1}`}
                aria-current={index === current}
                onClick={() => editor.goToPage(index)}
                className={cn(
                  'block w-full overflow-hidden rounded-md shadow-soft ring-1 ring-line',
                  index === current && 'ring-2 ring-ink',
                )}
              >
                <PageThumbnail
                  width={THUMB_WIDTH}
                  page={page}
                  layers={doc.notebook.layers}
                  background={doc.notebook.background}
                  size={size}
                />
              </button>
              {index === current ? (
                <SlideMenu editor={editor} index={index} count={pages.length} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line p-3">
        <Button
          className="w-full"
          icon={<Plus size={16} />}
          onClick={() => editor.addPageAt(current + 1)}
        >
          New slide
        </Button>
      </div>
    </aside>
  )
}

function SlideMenu({ editor, index, count }: { editor: Editor; index: number; count: number }) {
  const item =
    'flex h-11 w-full items-center gap-2.5 rounded-control px-3 text-left text-sm font-semibold hover:bg-hover disabled:opacity-40'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Slide options"
          className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full bg-surface-raised/95 text-ink shadow-soft"
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="grid w-56 gap-0.5 p-1.5">
        <button type="button" className={item} onClick={() => editor.duplicatePage(index)}>
          <Copy size={16} /> Duplicate
        </button>
        <button
          type="button"
          className={item}
          disabled={index === 0}
          onClick={() => editor.movePageTo(index, index - 1)}
        >
          <ArrowUp size={16} /> Move up
        </button>
        <button
          type="button"
          className={item}
          disabled={index === count - 1}
          onClick={() => editor.movePageTo(index, index + 1)}
        >
          <ArrowDown size={16} /> Move down
        </button>
        <button
          type="button"
          className={cn(item, 'text-danger')}
          disabled={count === 1}
          onClick={() => editor.deletePage(index)}
        >
          <Trash2 size={16} /> Delete slide
        </button>
      </PopoverContent>
    </Popover>
  )
}
