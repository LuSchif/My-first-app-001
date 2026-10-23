import type { NotebookDocument } from '../document/NotebookDocument.ts'
import type { Command } from './commands.ts'

const LIMIT = 300

/** Undo and redo for one open document. */
export class History {
  private past: Command[] = []
  private future: Command[] = []
  private readonly listeners = new Set<() => void>()
  private readonly doc: NotebookDocument

  constructor(doc: NotebookDocument) {
    this.doc = doc
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  execute(command: Command): void {
    command.apply(this.doc)
    this.record(command)
  }

  /** Records a command whose effect is already in the document (e.g. a finished broom drag). */
  record(command: Command): void {
    this.past.push(command)
    if (this.past.length > LIMIT) this.past.shift()
    this.future = []
    this.emit()
  }

  undo(): void {
    const command = this.past.pop()
    if (!command) return
    command.revert(this.doc)
    this.future.push(command)
    this.emit()
  }

  redo(): void {
    const command = this.future.pop()
    if (!command) return
    command.apply(this.doc)
    this.past.push(command)
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
