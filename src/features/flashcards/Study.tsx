import { Check, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { answer, cardsOf, RETRY_GAP, studyQueue, type Card } from '../../engine/model/flashcards.ts'
import type { CardStudy, Id, Notebook, Page } from '../../engine/model/types.ts'
import { pageSizeOf } from '../../engine/render/layout.ts'
import { Button, IconButton } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { PageThumbnail } from '../editor/PageThumbnail.tsx'

/** Drawing width of a card face; the card is shown at most this wide. */
const FACE_WIDTH = 760

/**
 * Studying a deck like with Anki: a card's front, a tap turns it over, then "Don't know" or
 * "Know it". Known cards come back after a growing pause; missed ones come again a few cards
 * later in the same session. Space turns the card, the arrow keys answer, Escape ends.
 */
export function Study({
  deck,
  pages,
  startedAt,
  onSave,
  onExit,
}: {
  deck: Notebook
  pages: readonly Page[]
  /** When studying began: decides which cards are due. */
  startedAt: number
  /** Called after every answer with how well each card is known. */
  onSave: (study: Record<Id, CardStudy>) => void
  onExit: () => void
}) {
  const cards = cardsOf(deck.pageIds)
  const [study, setStudy] = useState<Record<Id, CardStudy>>(deck.study ?? {})
  const [queue, setQueue] = useState<Card[]>(() => studyQueue(cards, deck.study, startedAt))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [score, setScore] = useState({ known: 0, missed: 0 })
  const byId = new Map(pages.map((p) => [p.id, p]))
  const card = queue[pos]
  const finished = queue.length > 0 && pos >= queue.length

  const restart = (all: boolean, now: number) => {
    setQueue(studyQueue(cards, study, now, all))
    setPos(0)
    setFlipped(false)
    setScore({ known: 0, missed: 0 })
  }

  const respond = (knew: boolean) => {
    if (!card || !flipped) return
    const next = { ...study, [card.front]: answer(study[card.front], knew, Date.now()) }
    setStudy(next)
    onSave(next)
    setScore((s) => (knew ? { ...s, known: s.known + 1 } : { ...s, missed: s.missed + 1 }))
    if (!knew) {
      // Again a few cards later (or at the end).
      setQueue((q) => {
        const copy = [...q]
        copy.splice(Math.min(copy.length, pos + 1 + RETRY_GAP), 0, card)
        return copy
      })
    }
    setPos((p) => p + 1)
    setFlipped(false)
  }

  const keys = useRef({ respond, flip: () => card && setFlipped((f) => !f), exit: onExit })
  useEffect(() => {
    keys.current = { respond, flip: () => card && setFlipped((f) => !f), exit: onExit }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        keys.current.flip()
      } else if (e.key === 'ArrowRight' || e.key === '2') keys.current.respond(true)
      else if (e.key === 'ArrowLeft' || e.key === '1') keys.current.respond(false)
      else if (e.key === 'Escape') keys.current.exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const size = pageSizeOf(deck)
  const total = queue.length

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Studying ${deck.title}`}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-desk pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <header className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <IconButton label="End studying" icon={<X size={22} />} onClick={onExit} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{deck.title}</p>
          {total ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-300 ease-gentle"
                style={{ width: `${(Math.min(pos, total) / total) * 100}%` }}
              />
            </div>
          ) : null}
        </div>
        {total && !finished ? (
          <span className="text-sm font-semibold text-ink-muted tabular-nums">
            {pos + 1} / {total}
          </span>
        ) : null}
      </header>

      <main className="grid min-h-0 flex-1 place-items-center px-4 pb-6">
        {total === 0 ? (
          <Message
            title="All caught up"
            text="No card is due right now. Cards you know come back after a pause; you can still go through all of them."
          >
            <Button onClick={onExit}>Done</Button>
            <Button
              variant="primary"
              icon={<RotateCcw size={18} />}
              onClick={() => restart(true, Date.now())}
            >
              Study all cards
            </Button>
          </Message>
        ) : finished ? (
          <Message
            title="Session done"
            text={`You knew ${score.known} ${score.known === 1 ? 'card' : 'cards'} and missed ${score.missed}. Missed cards come again soon.`}
          >
            <Button icon={<RotateCcw size={18} />} onClick={() => restart(true, Date.now())}>
              Study all again
            </Button>
            <Button variant="primary" onClick={onExit}>
              Done
            </Button>
          </Message>
        ) : card ? (
          <div className="grid w-full justify-items-center gap-6">
            {/* A new card starts face up: keyed by its place, it never shows the turn back. */}
            <button
              key={pos}
              type="button"
              aria-label={flipped ? 'Back of the card' : 'Front of the card, tap to turn'}
              onClick={() => setFlipped((f) => !f)}
              className="w-[min(46rem,100%)] animate-pop-in [perspective:1800px]"
            >
              <div
                className="relative transition-transform duration-500 ease-gentle [transform-style:preserve-3d]"
                style={{
                  aspectRatio: `${size.width} / ${size.height}`,
                  transform: flipped ? 'rotateY(180deg)' : 'none',
                }}
              >
                <Face page={byId.get(card.front)} deck={deck} />
                <Face page={byId.get(card.back)} deck={deck} back />
              </div>
            </button>
            {flipped ? (
              <div className="grid w-[min(30rem,100%)] animate-pop-in grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => respond(false)}
                  className="flex h-14 items-center justify-center gap-2 rounded-card bg-surface-raised font-semibold text-danger shadow-soft ring-1 ring-line hover:bg-surface-sunken"
                >
                  <X size={20} /> Don’t know
                </button>
                <button
                  type="button"
                  onClick={() => respond(true)}
                  className="flex h-14 items-center justify-center gap-2 rounded-card bg-ink font-semibold text-ink-inverse shadow-soft hover:bg-mocha"
                >
                  <Check size={20} /> Know it
                </button>
              </div>
            ) : (
              <p className="h-14 text-sm text-ink-muted">Tap the card to see the answer.</p>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}

/** One side of the card. */
function Face({ page, deck, back }: { page: Page | undefined; deck: Notebook; back?: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden rounded-card bg-paper shadow-overlay ring-1 ring-line [backface-visibility:hidden]',
      )}
      style={back ? { transform: 'rotateY(180deg)' } : undefined}
    >
      {page ? (
        <PageThumbnail
          width={FACE_WIDTH}
          page={page}
          layers={deck.layers}
          background={deck.background}
          size={pageSizeOf(deck)}
        />
      ) : null}
      <span className="absolute top-3 left-3 rounded-full bg-surface-raised/90 px-2 py-0.5 text-xs font-semibold text-ink-muted uppercase shadow-soft">
        {back ? 'Back' : 'Front'}
      </span>
    </div>
  )
}

function Message({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children: React.ReactNode
}) {
  return (
    <div className="grid max-w-md animate-pop-in justify-items-center gap-3 rounded-panel bg-surface-raised p-8 text-center shadow-raised">
      <p className="text-xl font-bold">{title}</p>
      <p className="text-ink-muted">{text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  )
}
