import { PAGE_SIZE, type Notebook, type PageSize } from '../model/types.ts'

/** Space between two pages in world space. */
export const PAGE_GAP = 28

/**
 * Where a document's pages sit in world space: stacked vertically, one after another. All pages
 * of a document have the same size (A4 for notebooks, 16:9 or 4:3 for presentations).
 */
export class PageLayout {
  readonly size: PageSize
  /** From the top of one page to the top of the next. */
  readonly pitch: number

  constructor(size: PageSize) {
    this.size = size
    this.pitch = size.height + PAGE_GAP
  }

  origin(index: number): { x: number; y: number } {
    return { x: 0, y: index * this.pitch }
  }

  contentHeight(pageCount: number): number {
    return Math.max(0, pageCount * this.pitch - PAGE_GAP)
  }

  /** The page under a world point, or -1 when the point is in a gap or beside the pages. */
  indexAt(x: number, y: number, pageCount: number): number {
    if (x < 0 || x > this.size.width || y < 0) return -1
    const index = Math.floor(y / this.pitch)
    if (index >= pageCount) return -1
    return y - index * this.pitch <= this.size.height ? index : -1
  }
}

/** Notebooks: A4 pages. */
export const A4_LAYOUT = new PageLayout(PAGE_SIZE)

const layouts = new Map<string, PageLayout>()

/** The page size of a document. */
export function pageSizeOf(notebook: Pick<Notebook, 'pageSize'>): PageSize {
  return notebook.pageSize ?? PAGE_SIZE
}

/** The layout of a document's pages. */
export function layoutOf(notebook: Pick<Notebook, 'pageSize'>): PageLayout {
  const size = pageSizeOf(notebook)
  if (size.width === PAGE_SIZE.width && size.height === PAGE_SIZE.height) return A4_LAYOUT
  const key = `${size.width}x${size.height}`
  let layout = layouts.get(key)
  if (!layout) layouts.set(key, (layout = new PageLayout(size)))
  return layout
}
