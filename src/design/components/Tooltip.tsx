import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <RadixTooltip.Provider delayDuration={400} skipDelayDuration={200}>
    {children}
  </RadixTooltip.Provider>
)

/** A short text label shown on hover or keyboard focus. Touch users see the button itself. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={8}
          className="z-50 animate-fade-in rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-ink-inverse shadow-raised"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )
}
