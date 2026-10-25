import type { NotebookDocument } from '../document/NotebookDocument.ts'
import type { CanvasObject, Id, LayerDef, Page, PaperKind } from '../model/types.ts'

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

export function setPagePaper(pageId: Id, before: PaperKind, after: PaperKind): Command {
  return {
    label: 'Paper',
    apply: (doc) => doc.setPaper(pageId, after),
    revert: (doc) => doc.setPaper(pageId, before),
  }
}

/** Changes the paper that new pages get. */
export function setNotebookPaper(before: PaperKind, after: PaperKind): Command {
  return {
    label: 'Paper',
    apply: (doc) => doc.updateNotebook({ paper: after }),
    revert: (doc) => doc.updateNotebook({ paper: before }),
  }
}

/** Replaces the notebook's layer list (add, remove, reorder, rename, show, lock, opacity). */
export function setLayers(label: string, before: LayerDef[], after: LayerDef[]): Command {
  return {
    label,
    apply: (doc) => doc.updateNotebook({ layers: after }),
    revert: (doc) => doc.updateNotebook({ layers: before }),
  }
}

/** Changes the color of the notebook's background layer. */
export function setNotebookBackground(before: string | undefined, after: string): Command {
  return {
    label: 'Background',
    apply: (doc) => doc.updateNotebook({ background: after }),
    revert: (doc) => doc.updateNotebook({ background: before }),
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

/** Moves the page at `from` to `to` in the page order. */
export function movePage(label: string, from: number, to: number): Command {
  let before: Id[] = []
  return {
    label,
    apply: (doc) => {
      before = doc.notebook.pageIds
      const ids = [...before]
      const [moved] = ids.splice(from, 1)
      if (moved) ids.splice(to, 0, moved)
      doc.setPageIds(ids)
    },
    revert: (doc) => doc.setPageIds(before),
  }
}

/** A slide's speaker notes or transition (presentations). */
export function setPageProps(
  label: string,
  pageId: Id,
  before: Partial<Pick<Page, 'notes' | 'transition'>>,
  after: Partial<Pick<Page, 'notes' | 'transition'>>,
): Command {
  return {
    label,
    apply: (doc) => doc.setPageProps(pageId, after),
    revert: (doc) => doc.setPageProps(pageId, before),
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
