import type { CanvasObject, Id, Notebook, Page } from '../model/types.ts'

export type DocumentChange = { type: 'page'; pageId: Id } | { type: 'notebook' }

/**
 * An open notebook in memory: the notebook record plus its pages. Commands change it through the
 * methods below; listeners (renderer, UI, autosave) are told what changed. Pages and objects are
 * replaced, never mutated, so undo can keep references to earlier versions.
 */
export class NotebookDocument {
  private _notebook: Notebook
  private readonly pages = new Map<Id, Page>()
  private readonly listeners = new Set<(change: DocumentChange) => void>()
  private readonly dirtyPages = new Set<Id>()
  private notebookDirty = false

  constructor(notebook: Notebook, pages: Page[]) {
    this._notebook = notebook
    for (const page of pages) this.pages.set(page.id, page)
  }

  get notebook(): Notebook {
    return this._notebook
  }

  /** Pages in notebook order. Pages missing from storage are skipped rather than crashing. */
  get pageList(): Page[] {
    return this._notebook.pageIds.flatMap((id) => {
      const page = this.pages.get(id)
      return page ? [page] : []
    })
  }

  page(id: Id): Page | undefined {
    return this.pages.get(id)
  }

  subscribe(listener: (change: DocumentChange) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setObjects(pageId: Id, objects: CanvasObject[]): void {
    const page = this.pages.get(pageId)
    if (!page) return
    this.pages.set(pageId, { ...page, objects, updatedAt: Date.now() })
    this.dirtyPages.add(pageId)
    this.notebookDirty = true
    this.emit({ type: 'page', pageId })
  }

  setBackground(pageId: Id, background: string | undefined): void {
    const page = this.pages.get(pageId)
    if (!page) return
    const next = { ...page, updatedAt: Date.now() }
    if (background) next.background = background
    else delete next.background
    this.pages.set(pageId, next)
    this.dirtyPages.add(pageId)
    this.notebookDirty = true
    this.emit({ type: 'page', pageId })
  }

  /** Replaces the page order; pages listed here that are not loaded yet must be added first. */
  setPageIds(pageIds: Id[]): void {
    this._notebook = { ...this._notebook, pageIds }
    this.notebookDirty = true
    this.emit({ type: 'notebook' })
  }

  putPage(page: Page): void {
    this.pages.set(page.id, page)
    this.dirtyPages.add(page.id)
  }

  updateNotebook(
    patch: Partial<Pick<Notebook, 'title' | 'layers' | 'cover' | 'folderId' | 'background'>>,
  ): void {
    this._notebook = { ...this._notebook, ...patch }
    this.notebookDirty = true
    this.emit({ type: 'notebook' })
  }

  hasUnsavedChanges(): boolean {
    return this.notebookDirty || this.dirtyPages.size > 0
  }

  /**
   * Hands the unsaved state to the caller and clears the dirty marks. If saving fails, pass the
   * result to `restoreDirty` so nothing is lost. Storage deletes pages that are no longer in
   * `notebook.pageIds`.
   */
  takeUnsaved(): UnsavedChanges | null {
    if (!this.hasUnsavedChanges()) return null
    this._notebook = { ...this._notebook, updatedAt: Date.now() }
    const pages = [...this.dirtyPages].flatMap((id) => {
      const page = this.pages.get(id)
      return page && this._notebook.pageIds.includes(id) ? [page] : []
    })
    this.dirtyPages.clear()
    this.notebookDirty = false
    return { notebook: this._notebook, pages }
  }

  restoreDirty(changes: UnsavedChanges): void {
    this.notebookDirty = true
    for (const page of changes.pages) this.dirtyPages.add(page.id)
  }

  private emit(change: DocumentChange): void {
    for (const listener of this.listeners) listener(change)
  }
}

export interface UnsavedChanges {
  notebook: Notebook
  pages: Page[]
}
