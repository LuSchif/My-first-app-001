import { fillToCss, prefersLightText, type Fill } from '../../engine/model/fill.ts'
import type { PaperKind } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { PaperPreview } from './PaperPreview.tsx'

/**
 * The notebook as it will look: its cover with the title, and its first page peeking out
 * behind it in the chosen paper. Follows every change in the dialog.
 */
export function NotebookPreview({
  title,
  cover,
  paper,
  width = 200,
}: {
  title: string
  cover: Fill
  paper: PaperKind
  width?: number
}) {
  const light = prefersLightText(cover)
  return (
    <div
      aria-label={`Preview of ${title || 'the notebook'}`}
      role="img"
      className="relative"
      style={{ width: width * 1.18, height: (width * 842) / 595 }}
    >
      {/* The first page, a little behind and to the right. */}
      <div
        className="absolute top-[4%] right-0 overflow-hidden rounded-r-md shadow-raised transition-transform duration-500 ease-gentle"
        style={{ transform: 'rotate(3deg)' }}
      >
        <PaperPreview kind={paper} width={width * 0.92} detail={0.6} />
      </div>
      {/* The cover, with a spine shadow along its left edge. */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex flex-col justify-end overflow-hidden rounded-l-md rounded-r-card p-5 shadow-overlay transition-[background] duration-300',
          light ? 'text-ink-inverse' : 'text-ink',
        )}
        style={{ width, background: fillToCss(cover) }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-ink/25 to-transparent"
        />
        <span className="line-clamp-4 text-2xl leading-tight font-bold [overflow-wrap:anywhere]">
          {title || 'Untitled'}
        </span>
      </div>
    </div>
  )
}
