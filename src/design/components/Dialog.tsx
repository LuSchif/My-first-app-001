import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { IconButton } from './IconButton.tsx'

export const Dialog = RadixDialog.Root
export const DialogTrigger = RadixDialog.Trigger
export const DialogClose = RadixDialog.Close

/** Centered modal panel with a title, optional description and a close button. */
export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-scrim backdrop-blur-[2px]" />
      <RadixDialog.Content
        // Radix expects either a Description or an explicit "no description".
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100%-2rem)] w-[min(36rem,calc(100%-2rem))]',
          '-translate-x-1/2 -translate-y-1/2 overflow-y-auto',
          'animate-pop-in rounded-panel bg-surface-raised p-6 shadow-overlay',
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <RadixDialog.Title className="text-xl font-bold tracking-tight text-balance">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="mt-1 text-sm text-ink-muted">
                {description}
              </RadixDialog.Description>
            ) : null}
          </div>
          <RadixDialog.Close asChild>
            <IconButton label="Close" icon={<X size={20} />} className="-mt-2 -mr-2" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}
