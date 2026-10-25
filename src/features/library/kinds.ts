import type { Notebook } from '../../engine/model/types.ts'

/** "notebook", "presentation" or "flashcards", for menus and messages. */
export function kindName(notebook: Pick<Notebook, 'kind'>): string {
  return notebook.kind === 'presentation'
    ? 'presentation'
    : notebook.kind === 'deck'
      ? 'flashcards'
      : 'notebook'
}
