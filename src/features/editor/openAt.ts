import { navigate } from '../../app/router.ts'

/** A page to show first when a notebook opens; set just before opening it. */
let pending: { id: string; page: number } | null = null

/** Opens a notebook (or presentation) at page `page`. */
export function openNotebookAt(id: string, page: number): void {
  pending = { id, page }
  navigate({ name: 'notebook', id })
}

/** The page to open notebook `id` at, once; 0 when none was asked for. */
export function takeOpeningPage(id: string): number {
  const page = pending?.id === id ? pending.page : 0
  pending = null
  return page
}
