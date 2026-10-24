import * as RadixPopover from '@radix-ui/react-popover'
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn.ts'
import { keyboardInset, onKeyboardInset } from '../../lib/keyboardInset.ts'
import { CloseContext, PopoverSideContext, useClosePopover } from './popoverContext.ts'

export const PopoverTrigger = RadixPopover.Trigger
export const PopoverClose = RadixPopover.Close

/** A popover that can be closed from inside (`useClosePopover`); controlled or not. */
export function Popover({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const [own, setOwn] = useState(false)
  const isOpen = open ?? own
  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setOwn(next)
      onOpenChange?.(next)
    },
    [open, onOpenChange],
  )
  const close = useCallback(() => setOpen(false), [setOpen])
  return (
    <CloseContext.Provider value={close}>
      <RadixPopover.Root open={isOpen} onOpenChange={setOpen}>
        {children}
      </RadixPopover.Root>
    </CloseContext.Provider>
  )
}

/** Floating panel for tool settings and small menus. */
export function PopoverContent({
  children,
  className,
  side,
  align = 'center',
}: {
  children: ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  const close = useClosePopover()
  const defaultSide = useContext(PopoverSideContext)
  const ref = useRef<HTMLDivElement>(null)
  // The app's own keyboard counts as the screen's edge: a popover opens above it, never under it.
  const keyboard = useSyncExternalStore(onKeyboardInset, keyboardInset)

  // Radix waits for a click before closing on an outside touch, and the canvas cancels touches
  // so no click ever comes. Close on the touch itself instead.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null
      const content = ref.current
      if (!target || !content) return
      if (content.contains(target)) return
      // A popover opened from this one (e.g. a font list) is portalled after it; touching it
      // keeps this one open.
      const other = target.closest('[data-radix-popper-content-wrapper]')
      const own = content.closest('[data-radix-popper-content-wrapper]')
      if (other && own && own.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return
      }
      if (content.id && target.closest(`[aria-controls="${content.id}"]`)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [close])

  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        side={side ?? defaultSide}
        align={align}
        sideOffset={10}
        collisionPadding={{ top: 16, right: 16, left: 16, bottom: 16 + keyboard }}
        // Focus going back to the trigger would pop up its tooltip after every choice, and focus
        // moving into the menu could land on a text field and bring up the keyboard.
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'z-60 max-h-[var(--radix-popover-content-available-height)] w-72 animate-pop-in overflow-y-auto rounded-panel bg-surface-raised p-4 shadow-raised ring-1 ring-line',
          className,
        )}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  )
}
