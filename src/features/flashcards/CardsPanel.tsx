import { ArrowDown, ArrowUp, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { cardsOf } from '../../engine/model/flashcards.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { PageThumbnail } from '../editor/PageThumbnail.tsx'
import { SLIDES_PANEL_WIDTH } from '../presentation/SlidesPanel.tsx'
import { useDocVersion } from '../presentation/useDocVersion.ts'

const THUMB_WIDTH = 148

/**
 * The cards of a deck, down the left edge: each with its front and its back. Tap a side to
 * edit it; add, copy, move and delete cards.
 */
export function CardsPanel({
  editor,
  state,
  doc,
}: {
  editor: Editor
  state: EditorState
  doc: NotebookDocument
}) {
  useDocVersion(doc)
  const cards = cardsOf(doc.notebook.pageIds)
  const size = pageSizeOf(doc.notebook)
  const current = Math.floor(state.pageIndex / 2)
  const list = useRef<HTMLOListElement>(null)

  useEffect(() => {
    list.current?.children[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [current])

  return (
    <aside
      aria-label="Cards"
      className="flex h-full shrink-0 flex-col border-r border-line bg-surface pt-[calc(76px+env(safe-area-inset-top))]"
      style={{ width: SLIDES_PANEL_WIDTH }}
    >
      <ol ref={list} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-3 pb-3">
        {cards.map((card) => (
          <li key={card.front} className="flex items-start gap-1.5">
            <span className="w-4 shrink-0 pt-1 text-right text-xs font-semibold text-ink-muted tabular-nums">
              {card.index + 1}
            </span>
            <div className="relative grid min-w-0 flex-1 gap-1.5">
              {(['front', 'back'] as const).map((side, s) => {
                const pageIndex = card.index * 2 + s
                const page = doc.page(card[side])
                if (!page || (side === 'back' && card.back === card.front)) return null
                return (
                  <button
                    key={side}
                    type="button"
                    aria-label={`Card ${card.index + 1}, ${side}`}
                    aria-current={pageIndex === state.pageIndex}
                    onClick={() => editor.goToPage(pageIndex)}
                    className={cn(
                      'relative block w-full overflow-hidden rounded-md shadow-soft ring-1 ring-line',
                      pageIndex === state.pageIndex && 'ring-2 ring-ink',
                    )}
                  >
                    <PageThumbnail
                      width={THUMB_WIDTH}
                      page={page}
                      layers={doc.notebook.layers}
                      background={doc.notebook.background}
                      size={size}
                    />
                    <span className="absolute top-1 left-1 rounded-full bg-surface-raised/90 px-1.5 text-[10px] font-semibold text-ink-muted uppercase">
                      {side}
                    </span>
                  </button>
                )
              })}
              {card.index === current ? (
                <CardMenu editor={editor} index={card.index} count={cards.length} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line p-3">
        <Button
          className="w-full"
          icon={<Plus size={16} />}
          onClick={() => editor.addCardAt(current + 1)}
        >
          New card
        </Button>
      </div>
    </aside>
  )
}

function CardMenu({ editor, index, count }: { editor: Editor; index: number; count: number }) {
  const item =
    'flex h-11 w-full items-center gap-2.5 rounded-control px-3 text-left text-sm font-semibold hover:bg-hover disabled:opacity-40'
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Card options"
          className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full bg-surface-raised/95 text-ink shadow-soft"
        >
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="grid w-56 gap-0.5 p-1.5">
        <button type="button" className={item} onClick={() => editor.duplicateCard(index)}>
          <Copy size={16} /> Duplicate card
        </button>
        <button
          type="button"
          className={item}
          disabled={index === 0}
          onClick={() => editor.moveCard(index, index - 1)}
        >
          <ArrowUp size={16} /> Move up
        </button>
        <button
          type="button"
          className={item}
          disabled={index === count - 1}
          onClick={() => editor.moveCard(index, index + 1)}
        >
          <ArrowDown size={16} /> Move down
        </button>
        <button
          type="button"
          className={cn(item, 'text-danger')}
          disabled={count === 1}
          onClick={() => editor.deleteCard(index)}
        >
          <Trash2 size={16} /> Delete card
        </button>
      </PopoverContent>
    </Popover>
  )
}
