import { Inbox } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Folder, Notebook } from '../../engine/model/types.ts'
import { cn } from '../../lib/cn.ts'
import { FolderGraphic } from '../folders/FolderGraphic.tsx'
import { refreshDropTarget, useDragState } from './dragDrop.ts'
import { folderTree } from './libraryActions.ts'

/** How close to the strip's ends the finger scrolls it, and how fast at most. */
const EDGE = 90
const SPEED = 14

/**
 * While a notebook is held, every folder slides up in a row at the bottom: drop the notebook on
 * one to put it there. Holding it near either end of the row scrolls the row that way.
 */
export function FolderDropStrip({
  folders,
  notebooks,
}: {
  folders: readonly Folder[]
  notebooks: readonly Notebook[]
}) {
  const drag = useDragState()
  const row = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const notebook =
    drag?.item.kind === 'notebook' ? notebooks.find((n) => n.id === drag.item.id) : undefined
  useEffect(() => {
    pointer.current = drag ? { x: drag.x, y: drag.y } : null
  })
  const active = notebook !== undefined

  // Scrolls the row while the finger rests near one of its ends.
  useEffect(() => {
    if (!active) return
    let frame = 0
    const tick = () => {
      const el = row.current
      const p = pointer.current
      if (el && p) {
        const r = el.getBoundingClientRect()
        if (p.y >= r.top - 20 && p.y <= r.bottom + 20) {
          const left = p.x - r.left
          const right = r.right - p.x
          const dx =
            left < EDGE
              ? -SPEED * (1 - Math.max(0, left) / EDGE)
              : right < EDGE
                ? SPEED * (1 - Math.max(0, right) / EDGE)
                : 0
          if (dx) {
            el.scrollLeft += dx
            refreshDropTarget()
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])

  if (!notebook) return null
  const over = drag?.over?.kind === 'folder' ? drag.over.id : null
  const list = folderTree(folders)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="pointer-events-auto animate-pop-in rounded-panel bg-surface-raised/95 shadow-overlay ring-1 ring-line backdrop-blur">
        <p className="px-4 pt-3 text-xs font-semibold tracking-[0.14em] text-ink-muted uppercase">
          Drop into a folder
        </p>
        {list.length === 0 && !notebook.folderId ? (
          <p className="px-4 pt-2 pb-4 text-sm text-ink-muted">
            No folders yet. Make one with the + on the Folders page.
          </p>
        ) : (
          <div
            ref={row}
            className="flex gap-3 overflow-x-auto px-4 pt-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {notebook.folderId ? (
              // Out of its folder, back to the top level.
              <div
                data-drop="root"
                className={cn(
                  'grid w-24 shrink-0 justify-items-center gap-1 rounded-card p-1.5 transition-transform duration-150 ease-gentle',
                  drag?.over?.kind === 'root' && 'scale-110 bg-hover ring-2 ring-accent',
                )}
              >
                <span className="grid aspect-[6/5] w-16 place-items-center rounded-control text-ink-muted ring-2 ring-line ring-inset [border-style:dashed]">
                  <Inbox size={22} />
                </span>
                <span className="w-full truncate text-center text-xs font-semibold">No folder</span>
              </div>
            ) : null}
            {list.map(({ folder, depth }) => {
              const current = folder.id === notebook.folderId
              return (
                <div
                  key={folder.id}
                  {...(current ? {} : { 'data-drop': 'folder', 'data-drop-id': folder.id })}
                  className={cn(
                    'grid w-24 shrink-0 justify-items-center gap-1 rounded-card p-1.5 transition-transform duration-150 ease-gentle',
                    over === folder.id && 'scale-110 bg-hover ring-2 ring-accent',
                    current && 'opacity-40',
                  )}
                >
                  <FolderGraphic
                    fill={folder.fill}
                    icon={folder.icon}
                    open={over === folder.id}
                    className="w-16"
                  />
                  <span className="w-full truncate text-center text-xs font-semibold">
                    {depth ? '› ' : ''}
                    {folder.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
