import { createElement } from 'react'
import { fillToCss, prefersLightText, type Fill } from '../../engine/model/fill.ts'
import { cn } from '../../lib/cn.ts'
import { folderIcon } from './folderIcons.ts'

/**
 * A folder drawn in its own colors: a back with a tab, sheets of paper inside, and a front with
 * the folder's icon. Open, the front tips forward and the sheets rise, like a real folder.
 */
export function FolderGraphic({
  fill,
  icon,
  open = false,
  className,
}: {
  fill: Fill
  icon: string
  open?: boolean
  className?: string
}) {
  const background = fillToCss(fill)
  const light = prefersLightText(fill)
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-[6/5] [perspective:900px]', className ?? 'w-full')}
    >
      {/* Back and tab, a shade darker than the front. */}
      <div
        className="absolute top-0 left-0 h-[22%] w-[44%] rounded-t-[12px] brightness-[0.8]"
        style={{ background }}
      />
      <div
        className="absolute inset-x-0 top-[8%] bottom-0 rounded-[14px] rounded-tl-none brightness-[0.8]"
        style={{ background }}
      />
      {/* Sheets inside. */}
      <div
        className={cn(
          'absolute inset-x-[10%] top-[16%] bottom-[14%] rounded-md bg-paper shadow-soft transition-transform duration-500 ease-gentle',
          open ? '-translate-y-[22%] -rotate-3' : '',
        )}
      />
      <div
        className={cn(
          'absolute inset-x-[14%] top-[20%] bottom-[14%] rounded-md bg-surface-raised shadow-soft transition-transform delay-75 duration-500 ease-gentle',
          open ? '-translate-y-[14%] rotate-2' : '',
        )}
      />
      {/* Front. */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 grid h-[76%] origin-bottom place-items-center rounded-[14px] shadow-raised transition-transform duration-500 ease-gentle',
          light ? 'text-ink-inverse' : 'text-ink',
        )}
        style={{
          background,
          transform: open ? 'rotateX(-38deg)' : 'rotateX(0deg)',
        }}
      >
        {createElement(folderIcon(icon), { className: 'size-[34%] opacity-85', strokeWidth: 1.6 })}
      </div>
    </div>
  )
}
