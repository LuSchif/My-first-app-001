import { ArrowDown, ArrowRight, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import type { PaperKind } from '../../engine/model/types.ts'
import { Button, Dialog, DialogContent, Switch } from '../../design/index.ts'
import { cn } from '../../lib/cn.ts'
import { PAPER_OPTIONS, paperPreviewStyle } from '../paper.ts'

const RING = 2 * Math.PI * 15

/**
 * Pulling past the last page: a card at the bottom (or the right edge, when pages follow to the
 * side) says to keep pulling, then fills a ring while the pull is held. Only a full ring adds a page, so a fling never does.
 */
export function PullForPage({ state }: { state: EditorState }) {
  const pull = state.pull
  if (!pull) return null
  const side = state.pageFlow === 'horizontal'
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-none absolute z-20 flex w-fit animate-pop-in items-center gap-3 rounded-panel bg-ink py-2 pr-5 pl-2 text-sm font-semibold text-ink-inverse shadow-overlay',
        side
          ? 'top-1/2 right-[max(20px,env(safe-area-inset-right))] -translate-y-1/2'
          : 'inset-x-0 bottom-[calc(28px+env(safe-area-inset-bottom))] mx-auto',
      )}
    >
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth="3"
        />
        <circle
          cx="20"
          cy="20"
          r="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={RING * (1 - pull.progress)}
          transform="rotate(-90 20 20)"
        />
        <foreignObject x="10" y="10" width="20" height="20">
          {pull.armed ? (
            <FilePlus2 size={20} />
          ) : side ? (
            <ArrowRight size={20} />
          ) : (
            <ArrowDown size={20} />
          )}
        </foreignObject>
      </svg>
      {pull.armed ? 'Hold to add a page' : 'Keep pulling for a new page'}
    </div>
  )
}

/** Which paper the new page gets; it can become the paper of every new page. */
export function NewPageMenu({ editor, state }: { editor: Editor; state: EditorState }) {
  const [paper, setPaper] = useState<PaperKind>(() => editor.notebookPaper())
  const [always, setAlways] = useState(false)
  return (
    <Dialog open={state.newPageMenu} onOpenChange={(open) => !open && editor.closeNewPageMenu()}>
      {state.newPageMenu ? (
        <DialogContent title="New page" className="w-[min(34rem,calc(100%-2rem))]">
          <div className="grid gap-5">
            <div role="group" aria-label="Paper" className="grid grid-cols-5 gap-3">
              {PAPER_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  aria-pressed={paper === option.kind}
                  onClick={() => setPaper(option.kind)}
                  className="group grid gap-1.5 rounded-lg p-1 text-sm"
                >
                  <span
                    className={cn(
                      'aspect-[3/4] w-full rounded-lg shadow-soft ring-1 ring-line',
                      'group-aria-pressed:ring-2 group-aria-pressed:ring-ink',
                    )}
                    style={paperPreviewStyle(option.kind)}
                  />
                  <span className="text-ink-muted group-aria-pressed:font-semibold group-aria-pressed:text-ink">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <Switch
              label="Use for all new pages"
              hint="New pages get this paper without asking; turn asking back on in the control center"
              checked={always}
              onChange={setAlways}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => editor.closeNewPageMenu()}>Cancel</Button>
              <Button variant="primary" onClick={() => editor.addPageAtEnd(paper, always)}>
                Add page
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
