import type { NotebookDocument, UnsavedChanges } from '../engine/document/NotebookDocument.ts'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/**
 * Saves a document shortly after each change, and immediately when the app goes to the
 * background. A failed save keeps the changes marked unsaved and retries.
 */
export class Autosave {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> | null = null
  private _status: SaveStatus = 'saved'
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private readonly doc: NotebookDocument
  private readonly save: (changes: UnsavedChanges) => Promise<void>
  private readonly delay: number

  constructor(
    doc: NotebookDocument,
    save: (changes: UnsavedChanges) => Promise<void>,
    delay = 400,
  ) {
    this.doc = doc
    this.save = save
    this.delay = delay
    this.unsubscribe = doc.subscribe(() => this.schedule())
  }

  get status(): SaveStatus {
    return this._status
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  schedule(delay = this.delay): void {
    // An error stays visible until a save succeeds.
    if (this._status === 'saved') this.setStatus('pending')
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), delay)
  }

  /** Saves everything now. Resolves once all changes made before the call are stored. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    while (this.running) await this.running
    const changes = this.doc.takeUnsaved()
    if (!changes) {
      if (this._status !== 'error') this.setStatus('saved')
      return
    }
    this.setStatus('saving')
    this.running = this.save(changes)
      .then(() => this.setStatus(this.doc.hasUnsavedChanges() ? 'pending' : 'saved'))
      .catch((error: unknown) => {
        console.error('Saving failed', error)
        this.doc.restoreDirty(changes)
        this.setStatus('error')
        this.schedule(3000)
      })
      .finally(() => {
        this.running = null
      })
    await this.running
  }

  dispose(): void {
    this.unsubscribe()
    if (this.timer) clearTimeout(this.timer)
  }

  private setStatus(status: SaveStatus): void {
    if (status === this._status) return
    this._status = status
    for (const listener of this.listeners) listener()
  }
}
