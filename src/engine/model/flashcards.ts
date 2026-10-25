import type { CardStudy, Id, Notebook } from './types.ts'

/**
 * Flashcards: a deck's pages come in pairs, each card's front and then its back. Studying works
 * like Anki with two answers: a card you know moves up a box and comes back after a longer
 * pause; one you don't know goes back to the first box and comes again in the same session.
 */

const DAY = 24 * 60 * 60 * 1000
/** The pause before a card in each box is due again, in days. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35, 80] as const

export interface Card {
  /** Its place in the deck, from 0. */
  index: number
  front: Id
  back: Id
}

/** The cards of a deck, from its page order. A lone last page counts as a card's front. */
export function cardsOf(pageIds: readonly Id[]): Card[] {
  const cards: Card[] = []
  for (let i = 0; i < pageIds.length; i += 2) {
    const front = pageIds[i]!
    cards.push({ index: i / 2, front, back: pageIds[i + 1] ?? front })
  }
  return cards
}

/** A card is due when it was never studied or its pause is over. */
export function isDue(study: CardStudy | undefined, now: number): boolean {
  return !study || study.due <= now
}

export function dueCount(notebook: Notebook, now: number): number {
  return cardsOf(notebook.pageIds).filter((c) => isDue(notebook.study?.[c.front], now)).length
}

/** The new state of a card after an answer. */
export function answer(study: CardStudy | undefined, knew: boolean, now: number): CardStudy {
  const box = knew ? Math.min((study?.box ?? 0) + 1, BOX_DAYS.length - 1) : 0
  return { box, due: now + BOX_DAYS[box]! * DAY, reviews: (study?.reviews ?? 0) + 1 }
}

/**
 * The cards to study now: those due, the longest overdue first and new ones after them. With
 * `all`, every card in deck order.
 */
export function studyQueue(
  cards: readonly Card[],
  study: Readonly<Record<Id, CardStudy>> | undefined,
  now: number,
  all = false,
): Card[] {
  if (all) return [...cards]
  const due = cards.filter((c) => isDue(study?.[c.front], now))
  const seen = due.filter((c) => study?.[c.front])
  const fresh = due.filter((c) => !study?.[c.front])
  seen.sort((a, b) => study![a.front]!.due - study![b.front]!.due)
  return [...seen, ...fresh]
}

/** How many cards later a card you didn't know comes again in the same session. */
export const RETRY_GAP = 3
