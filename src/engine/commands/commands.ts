import type { NotebookDocument } from '../document/NotebookDocument.ts'
import type { CanvasObject, Id, Page } from '../model/types.ts'

/** A reversible change to a document. */
export interface Command {
  readonly label: string
  apply(doc: NotebookDocument): void
  revert(doc: NotebookDocument): void
}

/**
 * Replaces a page's objects. Objects are immutable, so keeping the before and after arrays costs
 * only references, and this one command covers adding, erasing, moving and restyling.
 */
export function setPageObjects(
  label: string,
  pageId: Id,
  before: CanvasObject[],
  after: CanvasObject[],
): Command {
  return {
    label,
    apply: (doc) => doc.setObjects(pageId, after),
    revert: (doc) => doc.setObjects(pageId, before),
  }
}

export function setPageBackground(
  pageId: Id,
  before: string | undefined,
  after: string | undefined,
): Command {
  return {
    label: 'Page color',
    apply: (doc) => doc.setBackground(pageId, after),
    revert: (doc) => doc.setBackground(pageId, before),
  }
}

/** Inserts new pages at `index` in the page order. */
export function insertPages(label: string, index: number, pages: Page[]): Command {
  let before: Id[] = []
  return {
    label,
    apply: (doc) => {
      before = doc.notebook.pageIds
      for (const page of pages) doc.putPage(page)
      const ids = [...before]
      ids.splice(index, 0, ...pages.map((p) => p.id))
      doc.setPageIds(ids)
    },
    revert: (doc) => doc.setPageIds(before),
  }
}

export function removePage(label: string, pageId: Id): Command {
  let before: Id[] = []
  let page: Page | undefined
  return {
    label,
    apply: (doc) => {
      before = doc.notebook.pageIds
      page = doc.page(pageId)
      doc.setPageIds(before.filter((id) => id !== pageId))
    },
    revert: (doc) => {
      if (page) doc.putPage(page)
      doc.setPageIds(before)
    },
  }
}

/** Several commands undone and redone as one step. */
export function compound(label: string, commands: Command[]): Command {
  return {
    label,
    apply: (doc) => commands.forEach((c) => c.apply(doc)),
    revert: (doc) => [...commands].reverse().forEach((c) => c.revert(doc)),
  }
}
