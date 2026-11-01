import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { Tooltip } from './Tooltip.tsx'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name and tooltip text. Required: an icon alone is not a label. */
  label: string
  icon: ReactNode
  /** For tool buttons: whether this tool is the active one. */
  active?: boolean
  /**
   * The chosen look for Broomit's own icons: a light cream background, so the icon shows in
   * color, instead of the dark fill.
   */
  soft?: boolean
  size?: 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, active, soft = false, size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <Tooltip label={label}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-control text-ink',
          'transition-[background-color,color,transform] duration-150 ease-gentle',
          'hover:bg-hover active:scale-95 disabled:pointer-events-none disabled:opacity-45',
          soft
            ? 'aria-pressed:bg-icon-fill aria-pressed:text-icon-line aria-pressed:ring-1 aria-pressed:ring-icon-accent aria-pressed:ring-inset'
            : 'aria-pressed:bg-ink aria-pressed:text-ink-inverse aria-pressed:hover:bg-ink',
          size === 'md' ? 'size-11' : 'size-13',
          className,
        )}
        {...props}
      >
        {icon}
      </button>
    </Tooltip>
  )
})
