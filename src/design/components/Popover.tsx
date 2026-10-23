import * as RadixPopover from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export const Popover = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverClose = RadixPopover.Close

/** Floating panel for tool settings and small menus. */
export function PopoverContent({
  children,
  className,
  side = 'bottom',
  align = 'center',
}: {
  children: ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        side={side}
        align={align}
        sideOffset={10}
        collisionPadding={16}
        className={cn(
          'z-40 w-72 animate-pop-in rounded-panel bg-surface-raised p-4 shadow-raised ring-1 ring-line',
          className,
        )}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  )
}
