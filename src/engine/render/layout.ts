import { PAGE_SIZE, type Notebook, type PageFlow, type PageSize } from '../model/types.ts'

/** Space between two pages in world space. */
export const PAGE_GAP = 28

/**
 * Where a document's pages sit in world space: one after another, stacked downwards or side by
 * side. All pages of a document have the same size (A4 for notebooks, 16:9 or 4:3 for
 * presentations).
 */
export class PageLayout {
  readonly size: PageSize
  flow: PageFlow
  /**
   * In a presentation, only the slide in view takes input; points over the others (hidden
   * around it) belong to no page.
   */
  focus: number | null = null

  constructor(size: PageSize, flow: PageFlow = 'vertical') {
    this.size = size
    this.flow = flow
  }

  get horizontal(): boolean {
    return this.flow === 'horizontal'
  }

  /** From the start of one page to the start of the next, along the flow. */
  get pitch(): number {
    return (this.horizontal ? this.size.width : this.size.height) + PAGE_GAP
  }

  origin(index: number): { x: number; y: number } {
    return this.horizontal ? { x: index * this.pitch, y: 0 } : { x: 0, y: index * this.pitch }
  }

  /** The length of all pages along the flow. */
  contentLength(pageCount: number): number {
    return Math.max(0, pageCount * this.pitch - PAGE_GAP)
  }

  /** The page under a world point, or -1 when the point is in a gap or beside the pages. */
  indexAt(x: number, y: number, pageCount: number): number {
    const along = this.horizontal ? x : y
    const across = this.horizontal ? y : x
    const pageAlong = this.horizontal ? this.size.width : this.size.height
    const pageAcross = this.horizontal ? this.size.height : this.size.width
    if (across < 0 || across > pageAcross || along < 0) return -1
    const index = Math.floor(along / this.pitch)
    if (index >= pageCount) return -1
    if (this.focus !== null && index !== this.focus) return -1
    return along - index * this.pitch <= pageAlong ? index : -1
  }
}

/** The page size of a document. */
export function pageSizeOf(notebook: Pick<Notebook, 'pageSize'>): PageSize {
  return notebook.pageSize ?? PAGE_SIZE
}
